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
  background: "linear-gradient(180deg, rgba(17, 24, 39, 0.92), rgba(29, 37, 52, 0.9))",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "32px",
  boxShadow: "0 24px 80px rgba(4, 10, 24, 0.34)",
  backdropFilter: "blur(18px)",
  color: "#f4efe6"
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
  background: "rgba(221, 195, 139, 0.16)",
  color: "#f1d39d",
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
  color: "rgba(230, 224, 213, 0.78)",
  fontSize: "1.08rem",
  lineHeight: 1.6
};

const statStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02))",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const stats = [
  {
    value: "Agentic",
    label: "Resume, job, research, gap, rewrite, drafting, and review agents collaborate in one workflow."
  },
  {
    value: "Grounded",
    label: "Typed orchestration and review fallbacks keep outputs more stable than a one-shot prompt."
  },
  {
    value: "Practical",
    label: "The product tackles real job-search pain with research, analysis, rewriting, and application drafting."
  },
  {
    value: "Extensible",
    label: "Designed to grow into approvals, memory, tool use, and deeper retrieval over time."
  }
];

export default function HomePage() {
  return (
    <main className="page-shell" style={shellStyle}>
      <section className="hero" style={heroStyle}>
        <div className="hero-card hero-copy" style={copyStyle}>
          <span className="eyebrow" style={eyebrowStyle}>
            RoleForge
          </span>
          <h1 style={titleStyle}>Forge a stronger application with an agentic career system.</h1>
          <p style={leadStyle}>
            RoleForge uses specialized agents to read resumes, interpret job descriptions, research
            companies, identify real gaps, rewrite weak bullets, and draft application materials that
            are more grounded than a one-shot chatbot response.
          </p>
        </div>

        <div className="hero-card hero-stats" style={statsStyle}>
          {stats.map((stat) => (
            <div className="stat" key={stat.value} style={statStyle}>
              <strong style={{ display: "block", fontSize: "2rem", marginBottom: "8px" }}>
                {stat.value}
              </strong>
              <span style={{ color: "rgba(230, 224, 213, 0.78)", lineHeight: 1.5 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <JobCopilot />
    </main>
  );
}
