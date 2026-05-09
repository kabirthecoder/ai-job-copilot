import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runRoleForge } from "./dist/orchestrator.js";
import { listRuns, loadRun } from "./dist/persistence.js";

const port = Number(process.env.ROLEFORGE_PORT || 8787);

async function extractResumeTextFromPayload(fileName, mimeType, base64Data) {
  const bytes = Buffer.from(base64Data, "base64");
  const lowerName = (fileName || "").toLowerCase();

  if (mimeType?.includes("pdf") || lowerName.endsWith(".pdf")) {
    const pdfModule = await import("pdf-parse");
    const { PDFParse } = pdfModule;
    const workerPath = pathToFileURL(
      path.resolve(process.cwd(), "..", "node_modules", "pdf-parse", "dist", "pdf-parse", "esm", "pdf.worker.mjs")
    ).href;

    PDFParse.setWorker(workerPath);
    const parser = new PDFParse({ data: new Uint8Array(bytes) });

    try {
      const result = await parser.getText();
      const text = result.text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
      return {
        text,
        source: "pdf",
        ...extractIdentityHints(text)
      };
    } finally {
      await parser.destroy();
    }
  }

  const text = bytes.toString("utf8").trim();
  return {
    text,
    source: "text",
    ...extractIdentityHints(text)
  };
}

function extractIdentityHints(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const guessedName =
    lines.find((line) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line)) || "";

  return {
    guessedName,
    email
  };
}

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(body));
}

function html(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(body);
}

async function readJsonBody(request) {
  let rawBody = "";

  return new Promise((resolve, reject) => {
    request.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 2_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function renderConsoleApp() {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>RoleForge Console</title>
      <style>
        :root {
          --panel: rgba(17, 24, 39, 0.86);
          --border: rgba(230, 201, 143, 0.14);
          --text: #f8efe2;
          --muted: #b9ab93;
          --accent: #e6c98f;
          --accent-strong: #f59e0b;
          --success: #4ade80;
          --danger: #f87171;
          --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 32%),
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 30%),
            linear-gradient(180deg, #090d14 0%, #111827 100%);
          color: var(--text);
          min-height: 100vh;
        }
        .shell { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 24px; padding: 28px; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 24px; box-shadow: var(--shadow); backdrop-filter: blur(12px); }
        .sidebar { padding: 20px; position: sticky; top: 24px; height: calc(100vh - 56px); overflow: auto; }
        .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 8px; }
        .subtle { color: var(--muted); margin: 0 0 18px; line-height: 1.5; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; border: 1px solid var(--border); color: var(--muted); }
        .content { padding: 24px; display: grid; gap: 20px; }
        .hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap; }
        .hero h1 { margin: 0; font-size: 34px; letter-spacing: -0.05em; }
        .grid { display:grid; grid-template-columns:repeat(12,1fr); gap:18px; }
        .card { grid-column: span 12; background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 20px; padding: 18px; }
        .card.half { grid-column: span 6; }
        .card.third { grid-column: span 4; }
        h2, h3 { margin: 0 0 10px; }
        p, li { color: var(--muted); line-height: 1.6; }
        pre { white-space: pre-wrap; background: rgba(0,0,0,0.3); border-radius: 14px; padding: 14px; overflow: auto; color: #f5f5f4; border: 1px solid rgba(255,255,255,0.06); }
        textarea, input {
          width: 100%; border-radius: 14px; border: 1px solid var(--border);
          background: rgba(255,255,255,0.04); color: var(--text); padding: 12px 14px; font: inherit;
        }
        textarea { min-height: 130px; resize: vertical; }
        .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .form-grid .full { grid-column:1 / -1; }
        button {
          border: 0; border-radius: 14px; padding: 12px 16px; font-weight: 700; font: inherit; cursor: pointer;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%); color: #171717;
        }
        .ghost { background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--border); }
        .muted-small { color: var(--muted); font-size: 13px; }
        .status-ok { color: var(--success); }
        .status-bad { color: var(--danger); }
        .pill-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
        .pill { padding:7px 10px; border-radius:999px; border:1px solid var(--border); color: var(--text); font-size:13px; }
        .trace-item, .run-item { border:1px solid var(--border); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); }
        .run-list { display:grid; gap:12px; }
        .action-row { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
        @media (max-width:1100px) {
          .shell { grid-template-columns:1fr; }
          .sidebar { position:static; height:auto; }
          .card.half, .card.third { grid-column:span 12; }
          .form-grid { grid-template-columns:1fr; }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <aside class="panel sidebar">
          <p class="brand">RoleForge</p>
          <p class="subtle">Focused mode for stronger CV tailoring and more human cover letters. We’re keeping the UI centered on one role at a time so we can improve output quality instead of spreading attention too wide.</p>
          <div class="badge">CV + cover letter mode</div>
          <h3 style="margin-top:22px;">Recent runs</h3>
          <div id="run-list" class="run-list"></div>
        </aside>
        <main class="panel content">
          <section class="hero">
            <div>
              <h1>Tailor your CV and cover letter</h1>
              <p>Upload your CV, paste one job description, and get a clearer ATS view, a revised CV artifact, and a more human cover letter draft.</p>
            </div>
            <div class="badge" id="retrieval-badge">Retrieval not loaded</div>
          </section>

          <section class="card">
            <h2>Candidate and role</h2>
            <div class="form-grid">
              <input id="candidate-name" placeholder="Candidate name" value="" />
              <input id="candidate-email" placeholder="Email address" value="" />
              <input id="target-role" placeholder="Target role" value="" />
              <input id="company-name" placeholder="Company name" value="" />
              <input id="company-website" class="full" placeholder="Company website (optional)" value="" />
              <div class="full">
                <input id="resume-file" type="file" accept=".txt,.pdf" />
                <div id="upload-status" class="muted-small" style="margin-top:8px;">Upload a .txt or .pdf CV to auto-fill resume text.</div>
              </div>
              <textarea id="resume-text" class="full" placeholder="Paste resume text or upload a CV"></textarea>
              <textarea id="job-description" class="full" placeholder="Paste one job description"></textarea>
            </div>
            <div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <button id="run-button">Analyze and tailor</button>
              <button id="new-analysis-button" class="ghost" type="button">Reset</button>
              <span id="run-status" class="muted-small">Ready.</span>
            </div>
          </section>

          <div id="detail-root" class="grid">
            <section class="card">
              <h2>No run selected</h2>
              <p>Start a new run or open one from the left to inspect the revised CV and cover letter outputs.</p>
            </section>
          </div>
        </main>
      </div>
      <script>
        const runListEl = document.getElementById("run-list");
        const detailRoot = document.getElementById("detail-root");
        const runStatus = document.getElementById("run-status");
        const retrievalBadge = document.getElementById("retrieval-badge");
        const uploadStatus = document.getElementById("upload-status");
        let activeRunId = null;

        function section(title, content, className = "card") {
          return \`<section class="\${className}"><h2>\${title}</h2>\${content}</section>\`;
        }

        function pillRow(items) {
          return '<div class="pill-row">' + (items || []).map((item) => \`<span class="pill">\${escapeHtml(item)}</span>\`).join("") + '</div>';
        }

        async function loadRuns() {
          const response = await fetch("/runs");
          const runs = await response.json();
          runListEl.innerHTML = runs.length
            ? runs.map((run) => \`
                <button class="run-item \${activeRunId === run.id ? "active" : ""}" data-run-id="\${run.id}">
                  <div style="font-weight:700;">\${escapeHtml(run.targetRole)}</div>
                  <div class="muted-small">\${escapeHtml(run.companyName)}</div>
                  <div class="muted-small">\${new Date(run.createdAt).toLocaleString()}</div>
                </button>
              \`).join("")
            : '<div class="muted-small">No runs yet.</div>';

          [...runListEl.querySelectorAll("[data-run-id]")].forEach((button) => {
            button.addEventListener("click", () => openRun(button.getAttribute("data-run-id")));
          });
        }

        async function openRun(runId) {
          activeRunId = runId;
          const response = await fetch("/runs/" + runId);
          const run = await response.json();
          retrievalBadge.textContent = \`Embeddings: \${run.retrieval.embeddingProvider} | Vector store: \${run.retrieval.vectorStoreStatus}\`;
          renderRunDetail(run);
          await loadRuns();
        }

        function renderRunDetail(run) {
          const approvedClass = run.review.output.approved ? "status-ok" : "status-bad";
          const finalCoverLetter = run.review.output.revisedCoverLetter || run.coverLetterHumanizer?.output?.coverLetter || run.coverLetter.output.coverLetter;
          const finalResumeArtifact = run.rewrite.output.revisedResumeArtifact;
          const sections = [
            section("Run overview", \`
              <p><strong>Candidate:</strong> \${escapeHtml(run.request.candidateName)}<br />
              <strong>Company:</strong> \${escapeHtml(run.request.companyName)}<br />
              <strong>Role:</strong> \${escapeHtml(run.request.targetRole)}<br />
              <strong>Created:</strong> \${new Date(run.createdAt).toLocaleString()}</p>
              <p class="\${approvedClass}"><strong>Recommendation:</strong> \${escapeHtml(run.review.output.finalRecommendation)}</p>
            \`),
            section("ATS alignment", \`
              <p><strong>Current ATS score:</strong> \${run.gap.output.atsScore}/100</p>
              <p><strong>Target ATS score:</strong> \${run.gap.output.targetAtsScore}/100</p>
              <p><strong>Projected ATS after CV changes:</strong> \${run.rewrite.output.projectedAtsScore}/100</p>
              <h3>High priority fixes</h3>\${pillRow(run.gap.output.highPriorityFixes)}
            \`, "card third"),
            section("Role fit signals", \`
              <p><strong>Seniority:</strong> \${escapeHtml(run.nlp.seniorityHint)}</p>
              <h3>Matched skills</h3>\${pillRow(run.nlp.overlapSkills)}
              <h3>Missing skills</h3>\${pillRow(run.nlp.missingSkills)}
              <h3>Role themes</h3>\${pillRow(run.nlp.roleThemes)}
            \`, "card third"),
            section("Application strategy", \`
              <p><strong>Embedding provider:</strong> \${escapeHtml(run.retrieval.embeddingProvider)} | <strong>Vector store:</strong> \${escapeHtml(run.retrieval.vectorStoreStatus)}</p>
              <h3>Strengths</h3>\${pillRow(run.gap.output.strengths)}
              <h3>Focus areas</h3>\${pillRow(run.gap.output.focusAreas)}
              <ul>\${run.gap.output.applicationStrategy.map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}</ul>
            \`, "card third"),
            section("Cover letter", \`<pre id="cover-letter-output">\${escapeHtml(finalCoverLetter)}</pre>
              <div class="action-row">
                <button type="button" onclick="copyText('cover-letter-output')">Copy cover letter</button>
                <button type="button" class="ghost" onclick="downloadText('cover-letter-output', 'roleforge-cover-letter.txt')">Download cover letter</button>
              </div>\`, "card half"),
            section("Revised CV artifact", \`<pre id="resume-artifact-output">\${escapeHtml(finalResumeArtifact)}</pre>
              <div class="action-row">
                <button type="button" onclick="copyText('resume-artifact-output')">Copy CV draft</button>
                <button type="button" class="ghost" onclick="downloadText('resume-artifact-output', 'roleforge-revised-cv.md')">Download CV draft</button>
              </div>\`, "card half")
          ];

          if (window.location.search.includes("debug=1")) {
            sections.push(section("Debug trace", \`
              \${run.trace.map((entry) => \`
                <details class="trace-item">
                  <summary>\${escapeHtml(entry.agent)} | Model: \${escapeHtml(entry.model || "unknown")} | Fallback: \${entry.usedFallback ? "yes" : "no"}</summary>
                  <p>\${escapeHtml(entry.notes.join(" "))}</p>
                  <pre>\${escapeHtml(JSON.stringify(entry.output, null, 2))}</pre>
                </details>
              \`).join("")}
            \`));
          }

          detailRoot.innerHTML = sections.join("");
        }

        function buildPayload() {
          return {
            candidate: {
              name: document.getElementById("candidate-name").value,
              email: document.getElementById("candidate-email").value,
              resumeText: document.getElementById("resume-text").value
            },
            target: {
              targetRole: document.getElementById("target-role").value,
              companyName: document.getElementById("company-name").value,
              companyWebsite: document.getElementById("company-website").value,
              jobDescription: document.getElementById("job-description").value
            }
          };
        }

        async function submitRun() {
          runStatus.textContent = "Running agents...";
          const response = await fetch("/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload())
          });
          const run = await response.json();
          if (!response.ok) {
            runStatus.textContent = run.error || "Run failed.";
            detailRoot.innerHTML = section("Run failed", '<pre>' + escapeHtml(JSON.stringify(run, null, 2)) + '</pre>');
            return;
          }
          runStatus.textContent = "Run completed.";
          activeRunId = run.id;
          retrievalBadge.textContent = \`Embeddings: \${run.retrieval.embeddingProvider} | Vector store: \${run.retrieval.vectorStoreStatus}\`;
          renderRunDetail(run);
          await loadRuns();
        }

        function resetComposer() {
          activeRunId = null;
          retrievalBadge.textContent = "Retrieval not loaded";
          runStatus.textContent = "Ready.";
          ["candidate-name","candidate-email","target-role","company-name","company-website","resume-text","job-description"].forEach((id) => {
            document.getElementById(id).value = "";
          });
          document.getElementById("resume-file").value = "";
          uploadStatus.textContent = "Upload a .txt or .pdf CV to auto-fill resume text.";
          detailRoot.innerHTML = section("Fresh workspace", "<p>The form is reset. Recent runs stay in the sidebar, but nothing is carried into your new request automatically.</p>");
        }

        async function handleResumeUpload(event) {
          const file = event.target.files?.[0];
          if (!file) return;
          uploadStatus.textContent = "Reading resume...";
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          const base64 = btoa(binary);
          const response = await fetch("/upload-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64 })
          });
          const payload = await response.json();
          if (!response.ok) {
            uploadStatus.textContent = payload.details || payload.error || "Upload failed.";
            return;
          }
          document.getElementById("resume-text").value = payload.text || "";
          if (payload.guessedName) document.getElementById("candidate-name").value = payload.guessedName;
          if (payload.email) document.getElementById("candidate-email").value = payload.email;
          uploadStatus.textContent = \`Loaded \${file.name} from \${payload.source} input.\`;
        }

        function escapeHtml(value) {
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
        }

        async function copyText(id) {
          const text = document.getElementById(id)?.textContent || "";
          await navigator.clipboard.writeText(text);
          runStatus.textContent = "Copied to clipboard.";
        }

        function downloadText(id, fileName) {
          const text = document.getElementById(id)?.textContent || "";
          const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          runStatus.textContent = "Download started.";
        }

        document.getElementById("run-button").addEventListener("click", submitRun);
        document.getElementById("new-analysis-button").addEventListener("click", resetComposer);
        document.getElementById("resume-file").addEventListener("change", handleResumeUpload);
        loadRuns();
      </script>
    </body>
  </html>`;
}

function renderRunDetail(run) {
  const sections = run.trace
    .map(
      (entry) => `<section style="margin-bottom:24px;padding:16px;border:1px solid #3a2d1f;border-radius:12px;">
        <h2>${entry.agent}</h2>
        <p><strong>Model:</strong> ${entry.model || "unknown"} | <strong>Fallback:</strong> ${entry.usedFallback ? "yes" : "no"}</p>
        <p><strong>Notes:</strong> ${entry.notes.join(" ")}</p>
        <pre style="white-space:pre-wrap;background:#0c0c0c;padding:12px;border-radius:8px;">${escapeHtml(JSON.stringify(entry.output, null, 2))}</pre>
      </section>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>RoleForge Run ${run.id}</title>
      <style>
        body { font-family: Georgia, serif; background:#111; color:#f3eadb; padding:40px; }
        a { color:#e6c98f; }
        .card { max-width:1100px; margin:auto; }
      </style>
    </head>
    <body>
      <div class="card">
        <p><a href="/console">Back to console</a></p>
        <h1>${escapeHtml(run.job.output.roleFamily)} run</h1>
        <p><strong>Run ID:</strong> ${run.id}</p>
        <p><strong>Created:</strong> ${run.createdAt}</p>
        <p><strong>Recommendation:</strong> ${escapeHtml(run.review.output.finalRecommendation)}</p>
        ${sections}
      </div>
    </body>
  </html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    return json(response, 404, { error: "Not found" });
  }

  if (request.method === "OPTIONS") {
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { status: "ok" });
  }

  if (request.method === "GET" && request.url === "/") {
    return html(response, 200, renderConsoleApp());
  }

  if (request.method === "GET" && request.url === "/runs") {
    return json(response, 200, await listRuns());
  }

  if (request.method === "GET" && request.url === "/console") {
    return html(response, 200, renderConsoleApp());
  }

  if (request.method === "GET" && request.url.startsWith("/runs/")) {
    try {
      return json(response, 200, await loadRun(request.url.split("/").pop() || ""));
    } catch (error) {
      return json(response, 404, { error: "Run not found", details: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  if (request.method === "GET" && request.url.startsWith("/console/")) {
    try {
      return html(response, 200, renderRunDetail(await loadRun(request.url.split("/").pop() || "")));
    } catch (error) {
      return html(response, 404, `<h1>Run not found</h1><p>${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p>`);
    }
  }

  if (request.method === "POST" && request.url === "/run") {
    try {
      const payload = await readJsonBody(request);
      const result = await runRoleForge(payload);
      return json(response, 200, result);
    } catch (error) {
      return json(response, 400, {
        error: "Invalid request",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "POST" && request.url === "/upload-resume") {
    try {
      const payload = await readJsonBody(request);
      const result = await extractResumeTextFromPayload(
        payload.fileName,
        payload.mimeType,
        payload.base64
      );
      return json(response, 200, result);
    } catch (error) {
      return json(response, 400, {
        error: "Resume upload failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return json(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`RoleForge API listening on http://localhost:${port}`);
});
