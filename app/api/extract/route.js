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

    // COMBINED PROMPT: This saves 1 API request per run to avoid 429 errors.
    const combinedResp = await model.generateContent(
      `Analyze these two texts and return ONLY a valid JSON object.
      
      JD Text:
      ${jdText.slice(0, 3000)}
      
      Resume Text:
      ${resumeText.slice(0, 3000)}

      Return JSON format:
      {
        "jd_skills": [{"skill": "string", "importance": "critical", "level": "expert"}],
        "resume_skills": [{"skill": "string", "proficiency_claimed": "expert"}]
      }`
    );

    const parsedData = parseJSON(combinedResp.response.text());
    
    // Safely extract the lists
    const jdSkills = parsedData?.jd_skills || [];
    const resumeSkills = parsedData?.resume_skills || [];

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