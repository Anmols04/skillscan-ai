# SkillScan AI — Vercel Deployment Guide

Next.js 14 + Gemini 1.5 Flash. API key lives in Vercel env vars — never in code or GitHub.

## How the key stays safe

Your key goes into Vercel's encrypted Environment Variables dashboard.
Next.js API routes read it via process.env.GEMINI_API_KEY (server-side only).
It is never sent to the browser.

## Deploy (3 steps)

### 1. Get free Gemini API key
Go to aistudio.google.com → Get API key → Create API key
Copy the key (starts with AIza...)

### 2. Push to GitHub
cd skillscan-vercel
git init
git add .
git commit -m "SkillScan AI"
git remote add origin https://github.com/YOUR_USERNAME/skillscan-ai.git
git push -u origin main

Safe to make repo public — key is NOT in the code.

### 3. Deploy on Vercel
- vercel.com → Add New Project → import repo
- Before clicking Deploy, open "Environment Variables"
- Add: Name = GEMINI_API_KEY, Value = AIzaSy... (your key)
- Click Deploy

Done. Live at https://your-project.vercel.app

## Local development
npm install
echo "GEMINI_API_KEY=AIzaSy..." > .env.local
npm run dev

## File structure
app/page.jsx           - Landing page (no API key input)
app/assess/page.jsx    - Assessment (input → gaps → chat → plan)
app/api/extract/       - Extract skills from JD + resume
app/api/question/      - Generate assessment questions
app/api/evaluate/      - Score candidate answers
app/api/plan/          - Generate learning plan
app/api/parse-pdf/     - PDF parsing
lib/gemini.js          - Reads GEMINI_API_KEY from process.env

## Customise
Questions per skill: app/assess/page.jsx line 6 - QUESTIONS_PER_SKILL
Max skills assessed: app/api/extract/route.js - gaps.slice(0, 6)
LLM model: lib/gemini.js - gemini-205-flash
Colors: app/globals.css - CSS variables at top
