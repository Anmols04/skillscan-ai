"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────
const QUESTIONS_PER_SKILL = 2;

const TYPE_ICON = { video: "▶", course: "◉", article: "◎", practice: "◈" };
const PLATFORM_COLOR = {
  YouTube: "#b91c1c", Coursera: "#1d4ed8", freeCodeCamp: "#166534",
  "official-docs": "#374151", LeetCode: "#b45309", MDN: "#1d4ed8",
};

// ─── Score helpers ─────────────────────────────────────────────────────────────
function scoreClass(s) {
  return s >= 7 ? "score-high" : s >= 4 ? "score-mid" : "score-low";
}
function severityTag(s) {
  if (s === "none") return { cls: "tag-good", label: "No gap" };
  if (s === "minor") return { cls: "tag", label: "Minor gap" };
  if (s === "moderate") return { cls: "tag-important", label: "Moderate gap" };
  return { cls: "tag-critical", label: "Critical gap" };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssessPage() {
  const router = useRouter();
  const [stage, setStage] = useState("input");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Input
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [pdfName, setPdfName] = useState("");

  // Analysis results
  const [jdSkills, setJdSkills] = useState([]);
  const [resumeSkills, setResumeSkills] = useState([]);
  const [gaps, setGaps] = useState([]);

  // Assessment state
  const [skillIdx, setSkillIdx] = useState(0);
  const [messages, setMessages] = useState([]);
  const [currentQA, setCurrentQA] = useState([]); // {q, a} pairs
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [userInput, setUserInput] = useState("");
  const [evaluations, setEvaluations] = useState([]);
  const [thinking, setThinking] = useState(false);

  // Plan
  const [plan, setPlan] = useState(null);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── PDF upload ──────────────────────────────────────────────────────────────
  async function handlePdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfName(file.name);
    setStatus("Parsing PDF…");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/parse-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResumeText(data.text);
      setStatus("");
    } catch (err) {
      setError("PDF parse failed: " + err.message);
      setStatus("");
    }
  }

  // ── Stage 1 → 2: Analyze ───────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!jdText || !resumeText) return;
    setStage("analyzing");
    setStatus("Extracting skills from JD and resume…");
    setError("");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, resumeText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJdSkills(data.jdSkills);
      setResumeSkills(data.resumeSkills);
      setGaps(data.gaps);
      setStage("gap-review");
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStage("input");
      setStatus("");
    }
  }

  // ── Stage 3: Start assessment ───────────────────────────────────────────────
  async function startAssessment() {
    if (gaps.length === 0) {
      await generatePlan([]);
      return;
    }
    setStage("assessing");
    setSkillIdx(0);
    await loadNextQuestion(gaps[0], [], []);
  }

  async function loadNextQuestion(skill, qa, msgs) {
    setThinking(true);
    const intro = buildIntro(skill, 0, gaps.length);
    const msgsWithIntro = [...msgs, { role: "ai", text: intro }];
    setMessages(msgsWithIntro);

    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, previousQA: qa, questionNumber: qa.length + 1 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const q = data.question;
      setCurrentQuestion(q);
      setCurrentQA(qa);
      setMessages(prev => [...prev, { role: "ai", text: q }]);
    } catch (err) {
      setError(err.message);
    }
    setThinking(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function buildIntro(skill, idx, total) {
    const context = skill.claimed_level === "none"
      ? `This skill doesn't appear on your resume.`
      : `You've listed it as ${skill.claimed_level} level.`;
    return `— Skill ${idx + 1} of ${total}: ${skill.skill}\nRequired: ${skill.required_level} · Importance: ${skill.importance}\n${context} I'll ask you ${QUESTIONS_PER_SKILL} questions.`;
  }

  // ── Handle user answer ──────────────────────────────────────────────────────
  async function handleAnswer() {
    if (!userInput.trim() || thinking) return;
    const answer = userInput.trim();
    setUserInput("");
    const newQA = [...currentQA, { q: currentQuestion, a: answer }];
    setMessages(prev => [...prev, { role: "user", text: answer }]);
    setThinking(true);

    if (newQA.length >= QUESTIONS_PER_SKILL) {
      // Evaluate
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: gaps[skillIdx], qa: newQA }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const ev = data.evaluation;
        const newEvals = [...evaluations, ev];
        setEvaluations(newEvals);

        // Build evaluation message
        const sev = severityTag(ev.gap_severity);
        const evalMsg = [
          `Score: ${ev.score}/10 · ${ev.actual_level} · ${ev.gap_severity} gap`,
          ev.feedback,
          ev.strengths?.length ? `Strengths: ${ev.strengths.join(" · ")}` : "",
          ev.gaps?.length ? `Gaps: ${ev.gaps.join(" · ")}` : "",
          ev.weeks_to_close_gap ? `~${ev.weeks_to_close_gap} weeks to close gap` : "",
        ].filter(Boolean).join("\n");

        const nextIdx = skillIdx + 1;

        if (nextIdx >= gaps.length) {
          setMessages(prev => [
            ...prev,
            { role: "eval", text: evalMsg, score: ev.score },
            { role: "ai", text: "Assessment complete. Building your personalised learning plan…" },
          ]);
          setThinking(false);
          await generatePlan(newEvals);
        } else {
          setMessages(prev => [...prev, { role: "eval", text: evalMsg, score: ev.score }]);
          setSkillIdx(nextIdx);
          setCurrentQA([]);
          await loadNextQuestion(gaps[nextIdx], [], messages.concat(
            { role: "user", text: answer },
            { role: "eval", text: evalMsg, score: ev.score }
          ));
        }
      } catch (err) {
        setError(err.message);
        setThinking(false);
      }
    } else {
      // Ask follow-up question
      try {
        const res = await fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: gaps[skillIdx], previousQA: newQA, questionNumber: newQA.length + 1 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setCurrentQuestion(data.question);
        setCurrentQA(newQA);
        setMessages(prev => [...prev, { role: "ai", text: data.question }]);
      } catch (err) {
        setError(err.message);
      }
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ── Generate plan ───────────────────────────────────────────────────────────
  async function generatePlan(evals) {
    setStage("plan-loading");
    setStatus("Building your personalised learning plan…");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluations: evals }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlan(data.plan);
      setStage("plan");
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStage("assessing");
      setStatus("");
    }
  }

  // ── Download plan ───────────────────────────────────────────────────────────
  function downloadPlan() {
    const content = JSON.stringify({ plan, evaluations, gaps }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "skillscan_plan.json"; a.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <div className="container">
        <nav className="nav">
          <a href="/" className="nav-logo">Skill<span>Scan</span></a>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {stage !== "input" && gaps.length > 0 && (stage === "assessing" || stage === "plan") && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="progress-bar" style={{ width: 100 }}>
                  <div className="progress-fill" style={{
                    width: `${(evaluations.length / gaps.length) * 100}%`
                  }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-3)" }}>
                  {evaluations.length}/{gaps.length}
                </span>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/")}>← Exit</button>
          </div>
        </nav>
      </div>

      <main style={{ flex: 1 }}>

        {/* ── INPUT ─────────────────────────────────────────────────────── */}
        {stage === "input" && (
          <div className="container fade-up" style={{ padding: "48px 24px" }}>
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ marginBottom: 8 }}>New Assessment</h2>
              <p style={{ color: "var(--ink-3)" }}>
                Paste a job description and your resume to begin.
              </p>
            </div>

            {error && <div style={{
              padding: "12px 16px", borderRadius: "var(--radius)",
              background: "#fff0f0", border: "1px solid #f5d0d0",
              color: "var(--danger)", fontSize: "0.85rem", marginBottom: 24
            }}>{error}</div>}

            <div className="grid-2" style={{ marginBottom: 24 }}>
              {/* JD */}
              <div>
                <label style={{
                  display: "block", fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem", color: "var(--ink-3)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  marginBottom: 8
                }}>Job Description</label>
                <textarea
                  className="textarea"
                  rows={14}
                  placeholder="Paste the full job description here…"
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                />
              </div>

              {/* Resume */}
              <div>
                <label style={{
                  display: "block", fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem", color: "var(--ink-3)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  marginBottom: 8
                }}>Resume</label>
                <textarea
                  className="textarea"
                  rows={14}
                  placeholder="Paste your resume text here…"
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                />
              </div>
            </div>

            {/* PDF Upload */}
            <div className="card-flat" style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ cursor: "pointer" }}>
                <input type="file" accept=".pdf" onChange={handlePdf} style={{ display: "none" }} />
                <span className="btn btn-ghost btn-sm">↑ Upload PDF resume</span>
              </label>
              {pdfName && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-3)" }}>
                  ✓ {pdfName} parsed
                </span>
              )}
              {status && <span style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>{status}</span>}
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={!jdText.trim() || !resumeText.trim()}
            >
              Analyse Skills →
            </button>
          </div>
        )}

        {/* ── ANALYZING ─────────────────────────────────────────────────── */}
        {stage === "analyzing" && (
          <div className="container-sm fade-up" style={{
            padding: "120px 24px", textAlign: "center"
          }}>
            <span className="spinner" style={{ width: 24, height: 24, marginBottom: 20, display: "block", margin: "0 auto 20px" }} />
            <h3 style={{ marginBottom: 8 }}>{status}</h3>
            <p style={{ color: "var(--ink-3)", fontSize: "0.88rem" }}>
              Gemini is reading the job description and your resume.
            </p>
          </div>
        )}

        {/* ── GAP REVIEW ────────────────────────────────────────────────── */}
        {stage === "gap-review" && (
          <div className="container fade-up" style={{ padding: "48px 24px" }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ marginBottom: 8 }}>Skill Gap Analysis</h2>
              <p style={{ color: "var(--ink-3)" }}>
                Found {jdSkills.length} required skills · {resumeSkills.length} on resume · <strong>{gaps.length} gaps to assess</strong>
              </p>
            </div>

            <div className="grid-2" style={{ marginBottom: 36 }}>
              {/* Gaps column */}
              <div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                  color: "var(--ink-3)", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 14
                }}>Gaps to Assess</div>
                {gaps.length === 0 && (
                  <div className="card-flat">
                    <p style={{ fontSize: "0.88rem", color: "var(--success)" }}>
                      No significant gaps found. Resume covers all required skills.
                    </p>
                  </div>
                )}
                {gaps.map((g, i) => (
                  <div key={i} className="card-flat" style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.skill}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                          Required: {g.required_level} · Claimed: {g.claimed_level}
                        </div>
                      </div>
                      <span className={`tag tag-${g.importance === "critical" ? "critical" : g.importance === "important" ? "important" : ""}`}>
                        {g.importance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resume skills */}
              <div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                  color: "var(--ink-3)", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 14
                }}>Skills on Resume</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {resumeSkills.slice(0, 20).map((s, i) => (
                    <span key={i} className="tag" style={{ fontSize: "0.76rem" }}>
                      {s.skill}
                      {s.years_experience ? ` · ${s.years_experience}yr` : ""}
                    </span>
                  ))}
                  {resumeSkills.length > 20 && (
                    <span className="tag">+{resumeSkills.length - 20} more</span>
                  )}
                </div>
              </div>
            </div>

            <button className="btn btn-primary btn-lg" onClick={startAssessment}>
              {gaps.length === 0 ? "Generate Learning Plan →" : `Begin Assessment (${gaps.length} skills) →`}
            </button>
          </div>
        )}

        {/* ── ASSESSMENT CHAT ───────────────────────────────────────────── */}
        {stage === "assessing" && (
          <div className="container-sm" style={{ padding: "32px 24px" }}>
            <div style={{
              background: "var(--paper-2)", borderRadius: "var(--radius-lg)",
              border: "var(--border)", padding: "20px 24px", marginBottom: 24
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {gaps[skillIdx]?.skill}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                    Skill {skillIdx + 1} of {gaps.length} · {gaps[skillIdx]?.importance}
                  </div>
                </div>
                <div className="progress-bar" style={{ width: 80 }}>
                  <div className="progress-fill" style={{ width: `${(currentQA.length / QUESTIONS_PER_SKILL) * 100}%` }} />
                </div>
              </div>
            </div>

            {error && <div style={{
              padding: "10px 14px", borderRadius: "var(--radius)",
              background: "#fff0f0", color: "var(--danger)",
              fontSize: "0.82rem", marginBottom: 16
            }}>{error}</div>}

            {/* Chat messages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {messages.map((msg, i) => {
                if (msg.role === "eval") {
                  const s = msg.score;
                  return (
                    <div key={i} className="card-flat fade-up" style={{
                      borderLeft: `3px solid ${s >= 7 ? "var(--success)" : s >= 4 ? "#d97706" : "var(--danger)"}`,
                      fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                      color: "var(--ink-2)", whiteSpace: "pre-line", lineHeight: 1.8
                    }}>
                      {msg.text}
                    </div>
                  );
                }
                if (msg.role === "ai") {
                  return (
                    <div key={i} style={{ display: "flex" }}>
                      <div className="chat-bubble chat-ai fade-up"
                        style={{ whiteSpace: "pre-line" }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div className="chat-bubble chat-user fade-up">{msg.text}</div>
                  </div>
                );
              })}

              {thinking && (
                <div style={{ display: "flex" }}>
                  <div className="chat-bubble chat-ai" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="spinner" /> <span style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>thinking…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            {!thinking && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  className="textarea"
                  rows={3}
                  placeholder="Type your answer…"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAnswer();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAnswer}
                  disabled={!userInput.trim()}
                  style={{ minWidth: 80, alignSelf: "stretch" }}
                >
                  Send
                </button>
              </div>
            )}
            <p style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginTop: 8 }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}

        {/* ── PLAN LOADING ──────────────────────────────────────────────── */}
        {stage === "plan-loading" && (
          <div className="container-sm" style={{
            padding: "120px 24px", textAlign: "center"
          }}>
            <span className="spinner" style={{ width: 24, height: 24, display: "block", margin: "0 auto 20px" }} />
            <h3 style={{ marginBottom: 8 }}>Building your learning plan…</h3>
            <p style={{ color: "var(--ink-3)", fontSize: "0.88rem" }}>
              Gemini is generating a personalised week-by-week plan.
            </p>
          </div>
        )}

        {/* ── LEARNING PLAN ─────────────────────────────────────────────── */}
        {stage === "plan" && plan && (
          <div className="container fade-up" style={{ padding: "48px 24px 72px" }}>

            {/* Header */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h2 style={{ marginBottom: 8 }}>Personalised Learning Plan</h2>
                  <p>{plan.summary}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={downloadPlan}>
                  ↓ Download JSON
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid-3" style={{ marginBottom: 40 }}>
              {[
                ["Overall Readiness", plan.overall_readiness],
                ["Total Time", `${plan.total_weeks} weeks`],
                ["Skills Planned", plan.skills?.length],
              ].map(([label, val]) => (
                <div key={label} className="card" style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.8rem", fontWeight: 800,
                    letterSpacing: "-0.04em", marginBottom: 4
                  }}>{val}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-3)", textTransform: "uppercase" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Score summary */}
            <div style={{ marginBottom: 40 }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                color: "var(--ink-3)", textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 14
              }}>Assessment Scores</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {evaluations.map((ev, i) => (
                  <div key={i} className="card-flat" style={{ minWidth: 120, textAlign: "center" }}>
                    <div className={`score-badge ${scoreClass(ev.score)}`}>{ev.score}/10</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: 4 }}>{ev.skill}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ink-3)" }}>{ev.actual_level}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Wins */}
            {plan.quick_wins?.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                  color: "var(--ink-3)", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 14
                }}>Quick Wins — Do This Week</div>
                {plan.quick_wins.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "var(--border)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-4)", minWidth: 20 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: "0.9rem" }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <hr className="divider" />

            {/* Learning paths */}
            <div style={{ marginBottom: 40 }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                color: "var(--ink-3)", textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 24
              }}>Learning Paths</div>

              {plan.skills?.map((sp, i) => (
                <details key={i} style={{ marginBottom: 16 }} open={sp.priority === 1}>
                  <summary style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px", borderRadius: "var(--radius)",
                    background: "var(--paper-2)", border: "var(--border)",
                    cursor: "pointer", listStyle: "none", fontWeight: 600
                  }}>
                    <span className={`score-badge ${scoreClass(sp.score)}`} style={{ fontSize: "1.1rem" }}>
                      {sp.score}/10
                    </span>
                    <span style={{ flex: 1 }}>{sp.skill}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-3)", fontWeight: 400 }}>
                      {sp.weeks_needed}w · Priority {sp.priority}
                    </span>
                  </summary>

                  <div style={{ padding: "20px 0 8px" }}>
                    {sp.adjacent_skills?.length > 0 && (
                      <p style={{ fontSize: "0.83rem", color: "var(--ink-3)", marginBottom: 16 }}>
                        Also develops: {sp.adjacent_skills.join(" · ")}
                      </p>
                    )}

                    {sp.weekly_plan?.map((wp, j) => (
                      <div key={j} style={{ marginBottom: 20, paddingLeft: 16, borderLeft: "2px solid var(--paper-3)" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 8 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-4)" }}>
                            {wp.week_range}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{wp.focus}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)", marginLeft: "auto" }}>
                            {wp.hours_per_week}h/wk
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginBottom: 10 }}>
                          Milestone: {wp.milestone}
                        </p>
                        {wp.resources?.map((r, k) => (
                          <a key={k} href={r.url} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: "flex", gap: 10, alignItems: "center",
                              padding: "8px 12px", borderRadius: "var(--radius)",
                              background: "var(--paper-2)", border: "var(--border)",
                              textDecoration: "none", color: "var(--ink)",
                              marginBottom: 6, fontSize: "0.85rem",
                              transition: "background 0.12s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--paper-3)"}
                            onMouseLeave={e => e.currentTarget.style.background = "var(--paper-2)"}
                          >
                            <span style={{ fontSize: "0.7rem" }}>{TYPE_ICON[r.type] || "○"}</span>
                            <span style={{ flex: 1 }}>{r.title}</span>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                              color: PLATFORM_COLOR[r.platform] || "var(--ink-4)",
                              padding: "1px 6px", borderRadius: 3,
                              background: "var(--paper)"
                            }}>{r.platform}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--ink-4)" }}>
                              ~{r.estimated_hours}h
                            </span>
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {/* Projects */}
            {plan.projects?.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                  color: "var(--ink-3)", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 16
                }}>Hands-On Projects</div>
                <div className="grid-3">
                  {plan.projects.map((p, i) => (
                    <div key={i} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</span>
                        <span className="tag">{p.difficulty}</span>
                      </div>
                      <p style={{ fontSize: "0.82rem", marginBottom: 10, lineHeight: 1.6 }}>{p.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.skills_practiced?.map((s, j) => (
                          <span key={j} className="tag" style={{ fontSize: "0.68rem" }}>{s}</span>
                        ))}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 10 }}>
                        ~{p.estimated_days} days
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Motivational note */}
            {plan.motivational_note && (
              <div className="card-flat" style={{ borderLeft: "3px solid var(--ink-3)" }}>
                <p style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{plan.motivational_note}</p>
              </div>
            )}

            <div style={{ marginTop: 40, display: "flex", gap: 12 }}>
              <button className="btn btn-primary" onClick={downloadPlan}>↓ Download Plan</button>
              <button className="btn btn-ghost" onClick={() => {
                setStage("input");
                setJdText(""); setResumeText(""); setPdfName("");
                setGaps([]); setEvaluations([]); setPlan(null);
                setMessages([]); setCurrentQA([]); setSkillIdx(0);
                setError("");
              }}>New Assessment</button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: "var(--border)", padding: "20px 0" }}>
        <div className="container" style={{
          display: "flex", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)" }}>
            SkillScan
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)" }}>
            Free to use · No account needed
          </span>
        </div>
      </footer>
    </div>
  );
}
