// Unambiguous alphabet — no I, O, 0, 1 to avoid confusion when read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a short, human-friendly code (e.g. "FX7Q2"). */
export function generateCode(len = 5): string {
  if (typeof window === "undefined") {
    // SSR / Node fallback
    let s = "";
    for (let i = 0; i < len; i++)
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[arr[i] % ALPHABET.length];
  return s;
}
