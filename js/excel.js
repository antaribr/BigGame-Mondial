const HEADERS = [
  "ID",
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Option",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HEADER_ALIASES = {
  id: ["id", "questionid"],
  question: ["question", "questiontext", "السؤال"],
  option_a: ["optiona", "answera", "a", "الخيارا", "الخيارأ"],
  option_b: ["optionb", "answerb", "b", "الخيارب"],
  option_c: ["optionc", "answerc", "c", "الخيارج"],
  option_d: ["optiond", "answerd", "d", "الخيار د", "الخيار د"],
  correct_option: ["correctoption", "correctanswer", "correct", "answer", "الاجابةالصحيحة", "الإجابةالصحيحة"],
};

function getLibrary() {
  if (!window.XLSX?.read || !window.XLSX?.writeFile) {
    throw new Error("The Excel library did not load. Refresh the page and try again.");
  }
  return window.XLSX;
}

function normalizedHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_.\-:()]/g, "");
}

function cleanCell(value) {
  return String(value ?? "").trim();
}

function findColumn(headers, field) {
  const aliases = new Set(HEADER_ALIASES[field].map(normalizedHeader));
  return headers.find((header) => aliases.has(normalizedHeader(header))) || "";
}

function normalizeCorrectOption(value, options) {
  const clean = cleanCell(value);
  const direct = clean.toUpperCase().replace(/^OPTION\s+/, "").replace(/[.)\s]/g, "");
  if (["A", "B", "C", "D"].includes(direct)) return direct;
  const matching = ["A", "B", "C", "D"].find((letter) => clean.toLowerCase() === options[letter].toLowerCase());
  return matching || "";
}

function dateStamp() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function exportQuestionsToExcel(questions) {
  const XLSX = getLibrary();
  const rows = questions.map((question) => ({
    ID: cleanCell(question.id),
    Question: cleanCell(question.question),
    "Option A": cleanCell(question.option_a),
    "Option B": cleanCell(question.option_b),
    "Option C": cleanCell(question.option_c),
    "Option D": cleanCell(question.option_d),
    "Correct Option": cleanCell(question.correct_option).toUpperCase(),
  }));

  const worksheet = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: HEADERS })
    : XLSX.utils.aoa_to_sheet([HEADERS]);
  worksheet["!cols"] = [
    { wch: 38 },
    { wch: 55 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
  ];
  worksheet["!autofilter"] = { ref: `A1:G${Math.max(1, rows.length + 1)}` };

  const instructions = XLSX.utils.aoa_to_sheet([
    ["BigGame QR Quiz Excel Import"],
    ["Use the Questions sheet. Keep the seven column headers unchanged."],
    ["Correct Option must be A, B, C, or D."],
    ["Every row must include a question and all four options."],
    ["Keep an existing ID unchanged to update that question during import."],
    ["Leave ID blank when adding a new question."],
  ]);
  instructions["!cols"] = [{ wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.writeFile(workbook, `biggame-quiz-questions-${dateStamp()}.xlsx`, {
    compression: true,
    bookType: "xlsx",
  });
}

export async function importQuestionsFromExcel(file) {
  if (!file) throw new Error("Choose an Excel file first.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The Excel file is too large. Maximum size is 5 MB.");

  const XLSX = getLibrary();
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    dense: false,
  });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "questions") || workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
  if (!rawRows.length) throw new Error("The Questions sheet has no data rows.");

  const headers = Object.keys(rawRows[0]);
  const columns = {
    id: findColumn(headers, "id"),
    question: findColumn(headers, "question"),
    option_a: findColumn(headers, "option_a"),
    option_b: findColumn(headers, "option_b"),
    option_c: findColumn(headers, "option_c"),
    option_d: findColumn(headers, "option_d"),
    correct_option: findColumn(headers, "correct_option"),
  };
  const missingHeaders = Object.entries(columns).filter(([field, header]) => field !== "id" && !header).map(([field]) => field);
  if (missingHeaders.length) {
    throw new Error(`Missing Excel columns: ${missingHeaders.join(", ")}. Download the template and keep its headers.`);
  }

  const questions = [];
  const errors = [];
  const seen = new Set();
  const seenIds = new Set();
  rawRows.forEach((row, index) => {
    const excelRow = index + 2;
    const id = columns.id ? cleanCell(row[columns.id]) : "";
    const question = cleanCell(row[columns.question]);
    const options = {
      A: cleanCell(row[columns.option_a]),
      B: cleanCell(row[columns.option_b]),
      C: cleanCell(row[columns.option_c]),
      D: cleanCell(row[columns.option_d]),
    };
    const sourceCorrect = cleanCell(row[columns.correct_option]);
    if (!id && !question && !Object.values(options).some(Boolean) && !sourceCorrect) return;

    const missing = [];
    if (id && !UUID_PATTERN.test(id)) missing.push("valid ID (or leave it blank)");
    if (id && seenIds.has(id.toLowerCase())) missing.push("unique ID");
    if (!question) missing.push("Question");
    for (const letter of ["A", "B", "C", "D"]) if (!options[letter]) missing.push(`Option ${letter}`);
    const correctOption = normalizeCorrectOption(sourceCorrect, options);
    if (!correctOption) missing.push("Correct Option (A-D)");
    if (missing.length) {
      errors.push(`Row ${excelRow}: ${missing.join(", ")}`);
      return;
    }

    const duplicateKey = [question, options.A, options.B, options.C, options.D].map((value) => value.toLowerCase()).join("\u0000");
    if (seen.has(duplicateKey)) {
      errors.push(`Row ${excelRow}: duplicate question in this file`);
      return;
    }
    seen.add(duplicateKey);
    if (id) seenIds.add(id.toLowerCase());
    questions.push({
      ...(id ? { id } : {}),
      question,
      option_a: options.A,
      option_b: options.B,
      option_c: options.C,
      option_d: options.D,
      correct_option: correctOption,
    });
  });

  if (errors.length) {
    const preview = errors.slice(0, 8).join("\n");
    const more = errors.length > 8 ? `\n…and ${errors.length - 8} more error(s).` : "";
    throw new Error(`Fix these Excel rows before importing:\n${preview}${more}`);
  }
  if (!questions.length) throw new Error("No valid question rows were found in the Excel file.");
  if (questions.length > 500) throw new Error("A single Excel import can contain at most 500 questions.");
  return questions;
}
