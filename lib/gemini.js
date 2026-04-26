// lib/gemini.js — Server-side only, never imported in client components.
// API key is read from Vercel environment variable GEMINI_API_KEY.
// It is NEVER in code, NEVER in GitHub, NEVER sent to the browser.
import { GoogleGenerativeAI } from "@google/generative-ai";

export function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables."
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });
}

export function parseJSON(text) {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
    return null;
  }
}
