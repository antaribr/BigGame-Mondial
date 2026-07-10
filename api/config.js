// Vercel Function: exposes only values that are safe and necessary in the browser.
// Never add the service-role key or admin code to this response.
export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    adminFunction: process.env.ADMIN_FUNCTION_NAME || "admin-api",
    quizFunction: process.env.QUIZ_FUNCTION_NAME || "quiz-api",
    quiz: {
      questionCount: Number(process.env.QUIZ_QUESTION_COUNT) || 20,
      seconds: Number(process.env.QUIZ_SECONDS) || 20,
      pointsPerCorrect: Number(process.env.QUIZ_POINTS_PER_CORRECT) || 0.5
    }
  });
}
