import { loadConfig } from "./config.js";

let client;
let config;

export async function initSupabase() {
  config = await loadConfig();
  if (!window.supabase?.createClient) throw new Error("The bundled Supabase library did not load.");
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function getSupabase() {
  if (!client) throw new Error("Supabase has not been initialized.");
  return client;
}

export function getConfig() {
  if (!config) throw new Error("Configuration has not been loaded.");
  return config;
}
