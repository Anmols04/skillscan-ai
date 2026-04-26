import { NextResponse } from "next/server";
import { getModel, parseJSON } from "@/lib/gemini";

export const runtime = "nodejs";

const IMPORTANCE_RANK = { critical: 0, important: 1, "nice-to-have": 2 };
const LEVEL_RANK = { none: 0, beginner: 1, intermediate: 2, expert: 3 };

function fuzzyMatch(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  const ta = new Set(a.split(/\s+/));
  const tb = new Set(b.split(/\s+/));
  const overlap = [...ta].filter(x => tb.has(x)).length;
  return overlap / Math.max(ta.size, tb.size) >= 0.5;
}

export async function POST(req) {
  try {
    const { jdText, resumeText } = await req.json();
    const model = getModel();

    const jdResp = await model.generateContent(
      `Extract all technical and soft skills from this job description.
Return ONLY a valid JSON array, no markdown.
Each item: {"skill": string, "importance": "critical"|"important"|"nice-to-have", "level": "beginner"|"intermediate"|"expert"}

Job Description:
---
${jdText.slice(0, 4000)}
---`
    );
    const jdSkills = parseJSON(jdResp.response.text()) || [];

    const resResp = await model.generateContent(
      `Extract all skills from this resume.
Return ONLY a valid JSON array, no markdown.
Each item: {"skill": string, "years_experience": number|null, "proficiency_claimed": "beginner"|"intermediate"|"expert"}

Resume:
---
${resumeText.slice(0, 4000)}
---`
    );
    const resumeSkills = parseJSON(resResp.response.text()) || [];

    const gaps = [];
    for (const jdSkill of jdSkills) {
      const required = LEVEL_RANK[jdSkill.level] ?? 2;
      const matched = resumeSkills.find(r => fuzzyMatch(jdSkill.skill, r.skill));
      const claimed = LEVEL_RANK[matched?.proficiency_claimed ?? "none"] ?? 0;
      if (!matched || claimed < required) {
        gaps.push({
          skill: jdSkill.skill,
          required_level: jdSkill.level || "intermediate",
          importance: jdSkill.importance || "important",
          claimed_level: matched?.proficiency_claimed || "none",
          years_exp: matched?.years_experience || null,
          partially_known: !!matched,
        });
      }
    }
    gaps.sort((a, b) => (IMPORTANCE_RANK[a.importance] ?? 1) - (IMPORTANCE_RANK[b.importance] ?? 1));

    return NextResponse.json({ jdSkills, resumeSkills, gaps: gaps.slice(0, 6) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
