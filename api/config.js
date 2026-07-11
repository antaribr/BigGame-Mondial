// Public runtime configuration for the browser.
// Never expose SUPABASE_SERVICE_ROLE_KEY, ADMIN_CODE, or ADMIN_SESSION_SECRET here.

function numberSetting(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    quiz: {
      questionCount: Math.trunc(numberSetting(process.env.QUIZ_QUESTION_COUNT, 20, 1, 50)),
      seconds: numberSetting(process.env.QUIZ_SECONDS, 40, 5, 3600),
      pointsPerCorrect: numberSetting(process.env.QUIZ_POINTS_PER_CORRECT, 0.5, 0, 100)
    }
  });
}
