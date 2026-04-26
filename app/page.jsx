"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="container">
        <nav className="nav">
          <span className="nav-logo">Skill<span>Scan</span></span>
          <span className="tag">Beta</span>
        </nav>
      </div>

      <main style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div className="container-sm" style={{ padding: "72px 24px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink)" }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.75rem",
              color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase"
            }}>AI-Powered · Gemini 1.5 Flash</span>
          </div>

          <h1 style={{ marginBottom: 22 }}>
            Assess real skill.<br />Not claimed skill.
          </h1>

          <p style={{ fontSize: "1.05rem", marginBottom: 52, maxWidth: 500 }}>
            Upload a job description and your resume. The agent conversationally
            tests each skill gap, scores your actual proficiency, and builds a
            personalised week-by-week learning plan with curated resources.
          </p>

          <div style={{ display: "flex", gap: 36, marginBottom: 52, flexWrap: "wrap" }}>
            {[["01","Paste JD + Resume"],["02","Chat assessment"],["03","Honest skill scores"],["04","Learning plan"]].map(([n, label]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)" }}>{n}</span>
                <span style={{ fontSize: "0.9rem", color: "var(--ink-2)" }}>{label}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => router.push("/assess")}>
            Start Assessment →
          </button>
        </div>
      </main>

      <footer style={{ borderTop: "var(--border)", padding: "20px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)" }}>
            SkillScan · Powered by Gemini 1.5 Flash
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-4)" }}>
            Free to use · No account needed
          </span>
        </div>
      </footer>
    </div>
  );
}
