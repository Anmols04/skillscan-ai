// app/api/question/route.js
import { NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

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

Return only the question text — nothing else.`
    );

    return NextResponse.json({ question: resp.response.text().trim() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
