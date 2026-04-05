import { JobCopilot } from "@/components/job-copilot";
import type { CSSProperties } from "react";

const shellStyle: CSSProperties = {
  width: "min(1180px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0 64px"
};

const heroStyle: CSSProperties = {
  display: "grid",
  gap: "28px",
  gridTemplateColumns: "1.15fr 0.85fr",
  alignItems: "end",
  padding: "24px 0 40px"
};

const cardStyle: CSSProperties = {
  background: "rgba(255, 251, 245, 0.8)",
  border: "1px solid rgba(108, 74, 32, 0.18)",
  borderRadius: "28px",
  boxShadow: "0 20px 60px rgba(62, 40, 18, 0.12)",
  backdropFilter: "blur(12px)"
};

const copyStyle: CSSProperties = {
  ...cardStyle,
  padding: "32px"
};

const statsStyle: CSSProperties = {
  ...cardStyle,
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  padding: "22px"
};

const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  padding: "8px 14px",
  borderRadius: "999px",
  background: "#d8f1e8",
  color: "#0a5347",
  fontSize: "0.85rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: "18px 0 16px",
  fontSize: "clamp(2.6rem, 5vw, 5.2rem)",
  lineHeight: "0.95",
  letterSpacing: "-0.04em"
};

const leadStyle: CSSProperties = {
  margin: 0,
  maxWidth: "42rem",
  color: "#6b5644",
  fontSize: "1.08rem",
  lineHeight: 1.6
};

const statStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "#fffaf2",
  border: "1px solid rgba(108, 74, 32, 0.12)"
};

const stats = [
  {
    value: "Low Cost",
    label: "Start with rules + selective model calls so the product stays affordable."
  },
  {
    value: "Job Ready",
    label: "Showcase full-stack, AI UX, prompt design, and evaluation thinking in one app."
  },
  {
    value: "Portfolio Strong",
    label: "The product solves a real candidate pain point instead of being another generic chatbot."
  },
  {
    value: "End-to-End",
    label: "Resume upload, ATS scoring, outreach drafts, storage hooks, and LLM-ready architecture."
  }
];

export default function HomePage() {
  return (
    <main className="page-shell" style={shellStyle}>
      <section className="hero" style={heroStyle}>
        <div className="hero-card hero-copy" style={copyStyle}>
          <span className="eyebrow" style={eyebrowStyle}>
            AI Research + Job Copilot
          </span>
          <h1 style={titleStyle}>Turn your resume into a sharper job strategy.</h1>
          <p style={leadStyle}>
            Analyze resume-job fit, highlight missing skills, draft outreach, shape personal
            projects, and prepare interviews in one place. The app is built to grow from cheap
            heuristics into a production-style AI workflow.
          </p>
        </div>

        <div className="hero-card hero-stats" style={statsStyle}>
          {stats.map((stat) => (
            <div className="stat" key={stat.value} style={statStyle}>
              <strong style={{ display: "block", fontSize: "2rem", marginBottom: "8px" }}>
                {stat.value}
              </strong>
              <span style={{ color: "#6b5644", lineHeight: 1.5 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <JobCopilot />
    </main>
  );
}
