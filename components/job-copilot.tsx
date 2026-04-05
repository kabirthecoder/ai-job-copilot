"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useTransition } from "react";
import { getSavedAnalyses, saveAnalysis } from "@/lib/history";
import { getSupabaseIntegrationState, syncSavedAnalysisToSupabase } from "@/lib/supabase";
import type { AnalysisResult, SavedAnalysis, UploadResumeResponse } from "@/lib/types";

const workspaceStyle: CSSProperties = {
  display: "grid",
  gap: "22px",
  gridTemplateColumns: "1fr 1fr"
};

const panelStyle: CSSProperties = {
  background: "rgba(255, 251, 245, 0.8)",
  border: "1px solid rgba(108, 74, 32, 0.18)",
  borderRadius: "28px",
  boxShadow: "0 20px 60px rgba(62, 40, 18, 0.12)",
  backdropFilter: "blur(12px)",
  padding: "24px"
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "18px"
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "10px"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: "20px",
  border: "1px solid rgba(108, 74, 32, 0.18)",
  background: "rgba(255, 252, 247, 0.95)",
  color: "#24170d",
  minHeight: "56px",
  font: "inherit"
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "180px",
  resize: "vertical"
};

const helperStyle: CSSProperties = {
  margin: 0,
  color: "#6b5644",
  lineHeight: 1.6,
  fontSize: "0.92rem"
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "center",
  flexWrap: "wrap"
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "14px 22px",
  background: "#0e6b5c",
  color: "#fff",
  cursor: "pointer",
  font: "inherit"
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "rgba(36, 23, 13, 0.08)",
  color: "#24170d"
};

const resultsStyle: CSSProperties = {
  display: "grid",
  gap: "16px"
};

const scoreStyle: CSSProperties = {
  ...panelStyle,
  display: "grid",
  gap: "10px",
  justifyItems: "start",
  background: "linear-gradient(180deg, rgba(14, 107, 92, 0.1), rgba(255, 255, 255, 0.45))"
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

const chipsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "16px"
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  padding: "9px 12px",
  borderRadius: "999px",
  border: "1px solid rgba(108, 74, 32, 0.16)",
  background: "rgba(255, 251, 245, 0.85)",
  fontSize: "0.94rem"
};

const highlightedChipStyle: CSSProperties = {
  ...chipStyle,
  background: "#d8f1e8",
  color: "#0a5347"
};

const emptyStateStyle: CSSProperties = {
  padding: "28px",
  border: "1px dashed rgba(108, 74, 32, 0.24)",
  borderRadius: "24px",
  color: "#6b5644",
  background: "rgba(255, 251, 245, 0.45)"
};

const demoResume = `Built data-driven web apps with React, Next.js, Node.js, Python, SQL, Git, and machine learning coursework. Created REST APIs, dashboards, and automation tools. Interested in LLM applications and AI product engineering.`;

const demoJob = `We are hiring an AI Engineer with experience in Python, TypeScript, React, LLM applications, RAG pipelines, vector database workflows, prompt engineering, AWS, Docker, and testing. The ideal candidate can build product-facing AI assistants and evaluate model outputs.`;

export function JobCopilot() {
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("AI Engineer");
  const [companyName, setCompanyName] = useState("");
  const [resumeText, setResumeText] = useState(demoResume);
  const [jobDescription, setJobDescription] = useState(demoJob);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const supabaseState = getSupabaseIntegrationState();

  useEffect(() => {
    setSavedAnalyses(getSavedAnalyses());
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            targetRole,
            companyName,
            resumeText,
            jobDescription
          })
        });

        const payload = (await response.json()) as AnalysisResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Analysis failed.");
        }

        setResult(payload);
      } catch (submitError) {
        setResult(null);
        setError(
          submitError instanceof Error ? submitError.message : "Something went wrong during analysis."
        );
      }
    });
  }

  function loadDemo() {
    setName("Kabir");
    setTargetRole("AI Engineer");
    setCompanyName("OpenAI");
    setResumeText(demoResume);
    setJobDescription(demoJob);
  }

  async function handleSaveAnalysis() {
    if (!result) {
      return;
    }

    const entry = saveAnalysis(
      {
        name,
        targetRole,
        companyName,
        resumeText,
        jobDescription
      },
      result
    );

    setSavedAnalyses(getSavedAnalyses());

    const syncResult = await syncSavedAnalysisToSupabase(entry);
    setSaveMessage(
      `${syncResult.message} Saved analysis from ${new Date(entry.createdAt).toLocaleString()}.`
    );
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadMessage("Uploading resume...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as UploadResumeResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to process the uploaded resume.");
      }

      if (payload.text) {
        setResumeText(payload.text);
      }

      setUploadMessage(
        payload.warning ?? `Loaded ${payload.fileName} from ${payload.source.toUpperCase()} input.`
      );
    } catch (uploadError) {
      setUploadMessage(
        uploadError instanceof Error ? uploadError.message : "Unable to process the uploaded resume."
      );
    }
  }

  return (
    <div className="workspace" style={workspaceStyle}>
      <section className="panel" style={panelStyle}>
        <h2 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Run a career fit analysis</h2>
        <p style={helperStyle}>
          This full project path includes resume ingestion, ATS scoring, project recommendations,
          interview prep, outreach drafting, and persistence-ready architecture. Right now the app
          already supports the core flow with upload scaffolding and low-cost analysis fallback.
        </p>

        <form className="form-grid" onSubmit={handleSubmit} style={formStyle}>
          <div className="field" style={fieldStyle}>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="role">Target role</label>
            <input
              id="role"
              placeholder="AI Engineer"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="company">Target company</label>
            <input
              id="company"
              placeholder="OpenAI"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="resumeFile">Resume file upload</label>
            <input
              id="resumeFile"
              type="file"
              accept=".txt,.pdf"
              onChange={handleResumeUpload}
              style={{ ...inputStyle, padding: "12px 14px" }}
            />
            <p className="helper" style={helperStyle}>
              `.txt` and `.pdf` resumes can be uploaded here. Extracted text is loaded into the
              resume field so you can review or edit it before analysis.
            </p>
            {uploadMessage ? (
              <p className="helper" style={helperStyle}>
                {uploadMessage}
              </p>
            ) : null}
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="resume">Resume text</label>
            <textarea
              id="resume"
              placeholder="Paste your resume text here"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              style={textareaStyle}
            />
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="job">Job description</label>
            <textarea
              id="job"
              placeholder="Paste the job description here"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              style={textareaStyle}
            />
          </div>

          <p className="helper" style={helperStyle}>
            This form is designed to expand into PDF extraction, authentication, saved sessions,
            embeddings, and real LLM inference without changing the core UX.
          </p>
          <p className="helper" style={helperStyle}>
            {supabaseState.statusMessage}
          </p>

          <div className="actions" style={actionsStyle}>
            <button
              className="button button-primary"
              disabled={isPending}
              type="submit"
              style={{ ...primaryButtonStyle, opacity: isPending ? 0.58 : 1 }}
            >
              {isPending ? "Analyzing..." : "Analyze Fit"}
            </button>
            <button
              className="button button-secondary"
              onClick={loadDemo}
              type="button"
              style={secondaryButtonStyle}
            >
              Load demo data
            </button>
          </div>
        </form>

        {error ? (
          <p className="footer-note" style={{ marginTop: "22px", fontSize: "0.95rem", color: "#8b5e1a" }}>
            {error}
          </p>
        ) : null}
        {saveMessage ? (
          <p className="helper" style={helperStyle}>
            {saveMessage}
          </p>
        ) : null}
      </section>

      <section className="results" style={resultsStyle}>
        {result ? (
          <>
            <article className="result-card score-ring" style={scoreStyle}>
              <span className="eyebrow" style={eyebrowStyle}>
                Fit score
              </span>
              <strong style={{ fontSize: "clamp(2.2rem, 3vw, 3.6rem)" }}>{result.score}%</strong>
              <p style={helperStyle}>{result.summary}</p>
              <p style={helperStyle}>
                ATS alignment: <strong>{result.atsScore}%</strong>
              </p>
              <p style={helperStyle}>
                Provider: <strong>{result.provider ?? "unknown"}</strong>
                {result.model ? ` (${result.model})` : ""}
              </p>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Skill coverage</h3>
              <p style={helperStyle}>Matched skills extracted from the target role and your resume.</p>
              <div className="chips" style={chipsStyle}>
                {result.matchedSkills.length ? (
                  result.matchedSkills.map((skill) => (
                    <span className="chip highlight" key={skill} style={highlightedChipStyle}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="chip" style={chipStyle}>
                    No direct overlap detected yet
                  </span>
                )}
              </div>
              <div className="chips" style={chipsStyle}>
                {result.missingSkills.map((skill) => (
                  <span className="chip" key={skill} style={chipStyle}>
                    {skill}
                  </span>
                ))}
              </div>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Project ideas</h3>
              <ul className="list">
                {result.suggestedProjects.map((project) => (
                  <li key={project}>{project}</li>
                ))}
              </ul>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Recruiter notes</h3>
              <ul className="list">
                {result.recruiterTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Interview prep</h3>
              <ul className="list">
                {result.interviewQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Next steps</h3>
              <ul className="list">
                {result.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Application drafts</h3>
              <p style={helperStyle}>{result.coverLetterSnippet}</p>
              <p style={helperStyle}>{result.coldEmailSnippet}</p>
              <p style={helperStyle}>{result.portfolioPitch}</p>
              <div className="actions" style={actionsStyle}>
                <button
                  className="button button-secondary"
                  onClick={handleSaveAnalysis}
                  type="button"
                  style={secondaryButtonStyle}
                >
                  Save analysis
                </button>
              </div>
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Saved sessions</h3>
              <p style={helperStyle}>
                Local history works now. If Supabase is configured, each save also attempts a remote
                insert into `{supabaseState.table}`.
              </p>
              {savedAnalyses.length ? (
                <ul className="list">
                  {savedAnalyses.slice(0, 5).map((entry) => (
                    <li key={entry.id}>
                      {entry.input.targetRole || "Untitled role"} at {entry.input.companyName || "Target company"} with {entry.result.score}% fit
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={helperStyle}>No saved analyses yet.</p>
              )}
            </article>
          </>
        ) : (
          <div className="empty-state" style={emptyStateStyle}>
            Results will appear here after the first analysis. This workspace is already structured
            for saved sessions, chat, bullet rewriting, upload parsing, and LLM-generated reports.
          </div>
        )}
      </section>
    </div>
  );
}
