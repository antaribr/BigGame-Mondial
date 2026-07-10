let configPromise;

export function loadConfig() {
  if (!configPromise) configPromise = loadVercelConfig().then(validateConfig);
  return configPromise;
}

async function loadVercelConfig() {
  // On Vercel, /api/config converts project environment variables into the
  // public browser configuration. On other static hosts/local development,
  // fall back to config.json.
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) {
      const config = await response.json();
      if (hasSupabaseValues(config)) return config;
    }
  } catch {
    // A static host normally has no /api/config endpoint.
  }

  const response = await fetch("/config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load config.json (${response.status})`);
  return response.json();
}

function hasSupabaseValues(config) {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
}

function validateConfig(config) {
  if (!config || typeof config !== "object") throw new Error("The public configuration is not valid JSON.");
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
