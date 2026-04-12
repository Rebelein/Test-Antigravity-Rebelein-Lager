import { GoogleGenAI } from "@google/genai";

/**
 * Retrieves the Gemini API key from environment variables.
 * Checks Vite env first, then falls back to process.env.
 */
export const getApiKey = (): string => {
  // @ts-ignore – Vite env access
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  try {
    // @ts-ignore – legacy/server fallback
    if (process.env.API_KEY) return process.env.API_KEY;
  } catch { }
  return '';
};

/**
 * Creates a GoogleGenAI client instance.
 * Throws if no API key is configured.
 */
export const createAIClient = (): GoogleGenAI => {
  const key = getApiKey();
  if (!key) throw new Error("API Key fehlt. Bitte VITE_API_KEY in .env.local setzen.");
  return new GoogleGenAI({ apiKey: key });
};
