let configPromise;

export function loadConfig() {
  if (!configPromise) {
    configPromise = fetch("/config.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load config.json (${response.status})`);
        return response.json();
      })
      .then(validateConfig);
  }
  return configPromise;
}

function validateConfig(config) {
  if (!config || typeof config !== "object") throw new Error("config.json is not valid JSON.");
  config.adminFunction ||= "admin-api";
  config.quizFunction ||= "quiz-api";
  config.quiz = {
    questionCount: Number(config.quiz?.questionCount) || 20,
    seconds: Number(config.quiz?.seconds) || 20,
    pointsPerCorrect: Number(config.quiz?.pointsPerCorrect) || 0.5,
  };
  return config;
}

export function isConfigured(config) {
  return Boolean(
    config?.supabaseUrl?.startsWith("https://") &&
    !config.supabaseUrl.includes("YOUR-PROJECT") &&
    config?.supabaseAnonKey &&
    !config.supabaseAnonKey.includes("YOUR_PUBLIC"),
  );
}
