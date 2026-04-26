// app/api/plan/route.js
import { NextResponse } from "next/server";
import { getModel, parseJSON } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { evaluations } = await req.json();
    const model = getModel();

    const resp = await model.generateContent(
      `You are a senior learning & development specialist.
Create a detailed, actionable, personalised learning plan based on these skill assessments:

${JSON.stringify(evaluations, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "overall_readiness": "<e.g. 62%>",
  "summary": "<2-3 specific honest sentences>",
  "total_weeks": <integer>,
  "skills": [
    {
      "skill": "<name>",
      "score": <from eval>,
      "priority": <1=highest>,
      "weeks_needed": <integer>,
      "adjacent_skills": ["naturally paired skills"],
      "weekly_plan": [
        {
          "week_range": "Week 1-2",
          "focus": "<concise topic>",
          "hours_per_week": <integer>,
          "milestone": "<what they can do>",
          "resources": [
            {
              "title": "<title>",
              "platform": "YouTube|Coursera|freeCodeCamp|official-docs|LeetCode",
              "url": "<real URL>",
              "type": "video|course|article|practice",
              "estimated_hours": <number>
            }
          ]
        }
      ]
    }
  ],
  "quick_wins": ["<3 concrete actions for this week>"],
  "projects": [
    {
      "name": "<project name>",
      "description": "<2 sentences>",
      "skills_practiced": ["skill1"],
      "difficulty": "beginner|intermediate|advanced",
      "estimated_days": <integer>
    }
  ],
  "motivational_note": "<1 specific encouraging sentence>"
}

Use real working URLs. Make time estimates realistic.`
    );

    const plan = parseJSON(resp.response.text());
    if (!plan) throw new Error("Failed to parse learning plan from LLM.");

    return NextResponse.json({ plan });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
