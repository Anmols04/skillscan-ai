// app/api/evaluate/route.js
import { NextResponse } from "next/server";
import { getModel, parseJSON } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { skill, qa } = await req.json();
    const model = getModel();

    const qaText = qa.map(item => `Q: ${item.q}\nA: ${item.a}`).join("\n\n");

    const resp = await model.generateContent(
      `Evaluate this candidate's actual proficiency in: ${skill.skill}
Required level: ${skill.required_level}

Assessment conversation:
${qaText}

Be honest and rigorous — a 7+ score means genuinely solid knowledge.

Return ONLY valid JSON (no markdown):
{
  "skill": "${skill.skill}",
  "score": <integer 1-10>,
  "actual_level": "beginner|intermediate|expert",
  "gap_severity": "none|minor|moderate|critical",
  "strengths": ["observed strength"],
  "gaps": ["specific gap"],
  "feedback": "2 honest specific sentences",
  "weeks_to_close_gap": <integer, 0 if no gap>
}`
    );

    const result = parseJSON(resp.response.text()) || {
      skill: skill.skill,
      score: 5,
      actual_level: "intermediate",
      gap_severity: "moderate",
      strengths: [],
      gaps: ["Could not parse evaluation"],
      feedback: "Assessment recorded.",
      weeks_to_close_gap: 4,
    };

    result.importance = skill.importance;
    result.required_level = skill.required_level;

    return NextResponse.json({ evaluation: result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
