let configPromise;

export function loadConfig() {
  if (!configPromise) configPromise = loadRuntimeConfig().then(validateConfig);
  return configPromise;
}

async function loadRuntimeConfig() {
  // Vercel exposes public environment values through /api/config.
  // The JSON file is the dependency-free fallback for local/static hosting.
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) {
      const config = await response.json();
      if (hasSupabaseValues(config)) return config;
    }
  } catch {
    // A plain static server normally has no API route.
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
  config.quiz = {
    questionCount: Math.max(1, Math.min(50, Math.trunc(Number(config.quiz?.questionCount) || 20))),
    seconds: Math.max(5, Number(config.quiz?.seconds) || 20),
    pointsPerCorrect: Math.max(0, Number(config.quiz?.pointsPerCorrect) || 0.5),
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
