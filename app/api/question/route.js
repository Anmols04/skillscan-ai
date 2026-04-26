// app/api/question/route.js
import { NextResponse } from "next/server";
import { getModel, parseJSON } from "@/lib/gemini"; // <-- Added parseJSON here

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { skill, previousQA, questionNumber } = await req.json();
    const model = getModel();

    const prevText = previousQA?.length
      ? previousQA.map((qa, i) => `Q${i+1}: ${qa.q}\nA${i+1}: ${qa.a}`).join("\n\n")
      : "";

    const resp = await model.generateContent(
      `You are a sharp technical interviewer. You are assessing: ${skill.skill}
Required level: ${skill.required_level} | Candidate claims: ${skill.claimed_level}

${prevText ? `Previous exchange:\n${prevText}\n\n` : ""}Generate question #${questionNumber}.

Rules:
- Practical, scenario-based — NOT "what is X?" trivia
- Under 60 words, conversational and direct
- Build naturally on previous answers if any
- Do NOT mention scoring, evaluation, or that this is a test
- Ask exactly ONE question

Return ONLY valid JSON (no markdown):
{
  "question": "<the actual question text>"
}`
    );

    // Parse the JSON safely just like the other routes
    const result = parseJSON(resp.response.text());

    // Fallback question just in case parsing ever fails
    const finalQuestion = result?.question || "Could you tell me a bit more about your experience with this skill?";

    return NextResponse.json({ question: finalQuestion });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}