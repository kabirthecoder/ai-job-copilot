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

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? "";
}

function extractNameFromResume(text: string, email?: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (
      line.length < 3 ||
      line.length > 40 ||
      /@|https?:\/\/|linkedin|github|\+?\d/.test(line) ||
      /engineer|developer|scientist|student|resume|curriculum vitae/i.test(line)
    ) {
      continue;
    }

    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      return words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
  }

  if (email) {
    const prefix = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    if (prefix) {
      return prefix
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return "";
}

export function JobCopilot() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [targetRole, setTargetRole] = useState("AI Engineer");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [enableCompanyResearch, setEnableCompanyResearch] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const supabaseState = getSupabaseIntegrationState();

  useEffect(() => {
    setSavedAnalyses(getSavedAnalyses());
  }, []);

  useEffect(() => {
    if (!resumeText.trim()) {
      return;
    }

    if (!email) {
      const extractedEmail = extractEmail(resumeText);
      if (extractedEmail) {
        setEmail(extractedEmail);
      }
    }

    if (!name) {
      const inferredName = extractNameFromResume(resumeText, extractEmail(resumeText));
      if (inferredName) {
        setName(inferredName);
      }
    }
  }, [resumeText, name, email]);

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
            email,
            targetRole,
            companyName,
            companyWebsite,
            enableCompanyResearch,
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
          submitError instanceof Error
            ? submitError.message
            : "Something went wrong during analysis."
        );
      }
    });
  }

  function loadDemo() {
    setName("Kabir");
    setEmail("kabir@example.com");
    setTargetRole("AI Engineer");
    setCompanyName("OpenAI");
    setCompanyWebsite("https://openai.com");
    setEnableCompanyResearch(true);
    setResumeText(demoResume);
    setJobDescription(demoJob);
  }

  async function handleCopyCoverLetter() {
    if (!result?.coverLetterSnippet) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.coverLetterSnippet);
      setCopyMessage("Cover letter copied.");
    } catch {
      setCopyMessage("Could not copy automatically. You can still select and copy the text.");
    }
  }

  function handleDownloadCoverLetter() {
    if (!result?.coverLetterSnippet || typeof window === "undefined") {
      return;
    }

    const printable = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
    if (!printable) {
      setCopyMessage("Pop-up blocked. Please allow pop-ups to download the cover letter as PDF.");
      return;
    }

    const header = [name, email].filter(Boolean).join("<br />");
    const body = result.coverLetterSnippet
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
      .join("");

    printable.document.write(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Cover Letter</title>
          <style>
            body { font-family: Georgia, serif; color: #24170d; margin: 48px; line-height: 1.7; }
            .meta { margin-bottom: 28px; font-size: 15px; }
            h1 { margin: 0 0 24px; font-size: 28px; }
            p { margin: 0 0 16px; font-size: 16px; }
            @media print { body { margin: 32px; } }
          </style>
        </head>
        <body>
          <h1>Cover Letter</h1>
          ${header ? `<div class="meta">${header}</div>` : ""}
          ${body}
        </body>
      </html>`);
    printable.document.close();
    printable.focus();
    printable.print();
  }

  async function handleSaveAnalysis() {
    if (!result) {
      return;
    }

    const entry = saveAnalysis(
      {
        name,
        email,
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
      syncResult.status === "local"
        ? `Saved locally on ${new Date(entry.createdAt).toLocaleString()}.`
        : `${syncResult.message} Saved analysis from ${new Date(entry.createdAt).toLocaleString()}.`
    );
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadMessage("Uploading resume...");
    setResult(null);
    setSaveMessage(null);
    setCopyMessage(null);

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
        const extractedEmail = extractEmail(payload.text);
        const inferredName = extractNameFromResume(payload.text, extractedEmail);

        setEmail(extractedEmail);
        setName(inferredName);
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
          Upload your resume, map it against a role, and let the system draft a sharper job
          strategy with personalized project ideas and application materials.
        </p>

        <form className="form-grid" onSubmit={handleSubmit} style={formStyle}>
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
              Upload your resume first. The app will extract text and try to auto-fill your name
              and email before analysis.
            </p>
            {uploadMessage ? (
              <p className="helper" style={helperStyle}>
                {uploadMessage}
              </p>
            ) : null}
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              placeholder="Auto-filled from resume when possible"
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={inputStyle}
            />
            <p className="helper" style={helperStyle}>
              This is optional. The app tries to extract your name from the uploaded or pasted
              resume text and only needs manual correction if the guess is wrong.
            </p>
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            <label htmlFor="companyWebsite">Company website or job link</label>
            <input
              id="companyWebsite"
              placeholder="https://www.trivago.com or the job URL"
              value={companyWebsite}
              onChange={(event) => setCompanyWebsite(event.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="field" style={fieldStyle}>
            <label htmlFor="companyResearch">Company research mode</label>
            <input
              id="companyResearch"
              type="checkbox"
              checked={enableCompanyResearch}
              onChange={(event) => setEnableCompanyResearch(event.target.checked)}
              style={{ width: "20px", height: "20px" }}
            />
            <p className="helper" style={helperStyle}>
              Turn this on only when you want company-context drafting. It is slower because the app
              tries to fetch public company pages first.
            </p>
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
              Try demo data
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
        {copyMessage ? (
          <p className="helper" style={helperStyle}>
            {copyMessage}
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
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Skill coverage</h3>
              <p style={helperStyle}>Matched skills extracted from the target role and your resume.</p>
              <p style={helperStyle}>
                Role family: <strong>{result.roleFamily ?? "Unknown"}</strong>
                {" · "}
                Seniority: <strong>{result.seniority ?? "Unknown"}</strong>
              </p>
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
              {result.domainFocus?.length ? (
                <div className="chips" style={chipsStyle}>
                  {result.domainFocus.map((theme) => (
                    <span className="chip" key={theme} style={highlightedChipStyle}>
                      {theme}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Relevant experience</h3>
              {result.relevantExperience.length ? (
                <ul className="list">
                  {result.relevantExperience.map((project) => (
                    <li key={project}>{project}</li>
                  ))}
                </ul>
              ) : (
                <p style={helperStyle}>No strong existing experience signals were extracted yet.</p>
              )}
            </article>

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>New projects to build</h3>
              <ul className="list">
                {result.newProjectIdeas.map((project) => (
                  <li key={project}>{project}</li>
                ))}
              </ul>
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
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Must-have vs nice-to-have</h3>
              <p style={helperStyle}>Must-have skills</p>
              <div className="chips" style={chipsStyle}>
                {(result.mustHaveSkills ?? []).map((skill) => (
                  <span className="chip" key={skill} style={chipStyle}>
                    {skill}
                  </span>
                ))}
              </div>
              <p style={{ ...helperStyle, marginTop: "16px" }}>Nice-to-have skills</p>
              <div className="chips" style={chipsStyle}>
                {(result.niceToHaveSkills ?? []).map((skill) => (
                  <span className="chip" key={skill} style={highlightedChipStyle}>
                    {skill}
                  </span>
                ))}
              </div>
              {(result.languageRequirements ?? []).length ? (
                <>
                  <p style={{ ...helperStyle, marginTop: "16px" }}>Language requirements</p>
                  <div className="chips" style={chipsStyle}>
                    {(result.languageRequirements ?? []).map((language) => (
                      <span className="chip" key={language} style={highlightedChipStyle}>
                        {language}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
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
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Cover letter</h3>
              {(name || email) ? (
                <p style={{ ...helperStyle, whiteSpace: "pre-line" }}>
                  {[name, email].filter(Boolean).join("\n")}
                </p>
              ) : null}
              <p style={{ ...helperStyle, whiteSpace: "pre-line" }}>{result.coverLetterSnippet}</p>
              <div className="actions" style={actionsStyle}>
                <button
                  className="button button-secondary"
                  onClick={handleDownloadCoverLetter}
                  type="button"
                  style={secondaryButtonStyle}
                >
                  Download cover letter
                </button>
                <button
                  className="button button-secondary"
                  onClick={handleCopyCoverLetter}
                  type="button"
                  style={secondaryButtonStyle}
                >
                  Copy cover letter
                </button>
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
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Outreach and pitch</h3>
              <p style={helperStyle}>{result.coldEmailSnippet}</p>
              <p style={helperStyle}>{result.portfolioPitch}</p>
            </article>

            {result.companyResearch ? (
              <article className="result-card panel" style={panelStyle}>
                <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Company research</h3>
                <p style={helperStyle}>
                  Status: <strong>{result.companyResearch.status}</strong>
                </p>
                {result.companyResearch.companySummary ? (
                  <p style={helperStyle}>{result.companyResearch.companySummary}</p>
                ) : null}
                {result.companyResearch.status === "failed" ? (
                  <p style={{ ...helperStyle, marginTop: "12px" }}>
                    Try a direct company website instead of a job-board or LinkedIn link if you want
                    stronger research results.
                  </p>
                ) : null}
                {result.companyResearch.roleSummary ? (
                  <>
                    <p style={{ ...helperStyle, marginTop: "12px" }}>Role focus</p>
                    <p style={helperStyle}>{result.companyResearch.roleSummary}</p>
                  </>
                ) : null}
                {result.companyResearch.latestAchievements.length ? (
                  <>
                    <p style={{ ...helperStyle, marginTop: "12px" }}>Latest achievements</p>
                    <ul className="list">
                      {result.companyResearch.latestAchievements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {result.companyResearch.sourceUrls.length ? (
                  <>
                    <p style={{ ...helperStyle, marginTop: "12px" }}>Sources</p>
                    <ul className="list">
                      {result.companyResearch.sourceUrls.map((item) => (
                        <li key={item}>
                          <a href={item} target="_blank" rel="noreferrer" style={{ color: "#0a5347" }}>
                            {item}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </article>
            ) : null}

            <article className="result-card panel" style={panelStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.5rem" }}>Saved sessions</h3>
              <p style={helperStyle}>{supabaseState.statusMessage}</p>
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
