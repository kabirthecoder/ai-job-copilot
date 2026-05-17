import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  authenticateUser,
  createSession,
  getUserFromSession,
  registerUser,
  revokeSession
} from "./dist/auth.js";
import { runRoleForge } from "./dist/orchestrator.js";
import { listRuns, loadRun } from "./dist/persistence.js";

const port = Number(process.env.ROLEFORGE_PORT || process.env.PORT || 8787);
const SESSION_COOKIE = "roleforge_session";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMITS = {
  auth: { limit: 12, windowMs: RATE_LIMIT_WINDOW_MS },
  upload: { limit: 20, windowMs: RATE_LIMIT_WINDOW_MS },
  run: { limit: 15, windowMs: RATE_LIMIT_WINDOW_MS },
  read: { limit: 90, windowMs: RATE_LIMIT_WINDOW_MS }
};
const rateLimitStore = new Map();

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [key, ...valueParts] = chunk.split("=");
        return [key, decodeURIComponent(valueParts.join("=") || "")];
      })
  );
}

function getClientKey(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function enforceRateLimit(request, bucketName) {
  const bucket = RATE_LIMITS[bucketName];
  if (!bucket) return null;

  const key = `${bucketName}:${getClientKey(request)}`;
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + bucket.windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count > bucket.limit) {
    return {
      error: "Too many requests",
      details: "Please wait a moment before trying again."
    };
  }

  return null;
}

function validateOrigin(request) {
  if (request.method === "GET" || request.method === "OPTIONS") {
    return null;
  }

  const origin = String(request.headers.origin || "");
  if (!origin) {
    return null;
  }

  const host = String(request.headers.host || "");

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return {
        error: "Invalid origin",
        details: "This request origin is not allowed."
      };
    }
  } catch {
    return {
      error: "Invalid origin",
      details: "This request origin is not allowed."
    };
  }

  return null;
}

async function getAuthenticatedUser(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return getUserFromSession(token);
}

function attachCookie(response, cookieValue) {
  response.setHeader("Set-Cookie", cookieValue);
}

function buildSessionCookie(token) {
  const isSecure = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}; Max-Age=${60 * 60 * 24 * 14}`;
}

function buildExpiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

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
  const guessedName = guessCandidateName(lines, email);

  return {
    guessedName,
    email
  };
}

function guessCandidateName(lines, email) {
  const noisePattern = /resume|curriculum|vitae|cv|email|phone|mobile|linkedin|github|portfolio|address|engineer|developer|analyst|scientist|manager|student|university|college|experience|education|skills|projects|profile|languages|certifications/i;
  const fontPattern = /roboto|lato|inter|montserrat|poppins|open sans|merriweather|source sans|playfair/i;
  const rankedCandidates = lines
    .slice(0, 12)
    .map((rawLine, index) => {
      const line = rawLine.replace(/[|•·,]/g, " ").replace(/\s+/g, " ").trim();
      if (!line || line.includes("@") || noisePattern.test(line) || fontPattern.test(line)) return null;
      if (line.length < 4 || line.length > 48) return null;
      if (!/^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(line)) return null;

      const words = line.split(/\s+/);
      let score = 0;
      if (words.length >= 2 && words.length <= 3) score += 4;
      if (/^[A-Z\s.'-]+$/.test(line)) score += 5;
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(line)) score += 4;
      if (index <= 3) score += 3;
      if (words.every((word) => word.length > 1 && word.length < 15)) score += 2;

      return { line, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  if (rankedCandidates[0]?.line) {
    return rankedCandidates[0].line
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  const emailPrefix = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!emailPrefix) {
    return "";
  }

  return emailPrefix
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferRoleFromDescription(jobDescription) {
  const text = String(jobDescription || "");
  const patterns = [
    /\b(?:as an?|for an?|position:?|role:?)\s+([A-Z][A-Za-z /+-]*(?:Engineer|Scientist|Analyst|Developer|Manager|Consultant|Specialist))/i,
    /\b([A-Z][A-Za-z /+-]*(?:Engineer|Scientist|Analyst|Developer|Manager|Consultant|Specialist))\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function inferCompanyFromDescription(jobDescription) {
  const text = String(jobDescription || "");
  const patterns = [
    /\bat\s+([A-Z][A-Za-z0-9&.'-]+)(?:\s|,|\.|!)/,
    /\bjoin\s+([A-Z][A-Za-z0-9&.'-]+)(?:\s|,|\.|!)/i,
    /\bcompany:\s*([A-Z][A-Za-z0-9&.' -]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function normalizeRunPayload(payload) {
  const candidate = payload?.candidate || {};
  const target = payload?.target || {};
  const jobDescription = String(target.jobDescription || "").trim();
  const targetRole = String(target.targetRole || "").trim() || inferRoleFromDescription(jobDescription);
  const companyName = String(target.companyName || "").trim() || inferCompanyFromDescription(jobDescription);

  if (!String(candidate.resumeText || "").trim()) {
    throw new Error("Upload a CV before running analysis.");
  }

  if (!jobDescription) {
    throw new Error("Paste a job description before running analysis.");
  }

  if (!targetRole) {
    throw new Error("Add the target role or include it clearly in the job description.");
  }

  return {
    ...payload,
    candidate: {
      ...candidate,
      name: String(candidate.name || "").trim(),
      email: String(candidate.email || "").trim(),
      resumeText: String(candidate.resumeText || "").trim()
    },
    target: {
      ...target,
      targetRole,
      companyName,
      companyWebsite: String(target.companyWebsite || "").trim(),
      jobDescription
    }
  };
}

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin"
  });
  response.end(JSON.stringify(body));
}

function html(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  response.end(body);
}

function unauthorized(response) {
  return json(response, 401, { error: "Unauthorized", details: "Please sign in to continue." });
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = 15 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    request.on("data", (chunk) => {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufferChunk.length;

      if (totalBytes > maxBytes) {
        reject(new Error("Payload too large. Please upload a smaller CV PDF or TXT file."));
        request.destroy();
        return;
      }

      chunks.push(bufferChunk);
    });

    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(rawBody || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function readRawBody(request, maxBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let totalBytes = 0;

  return new Promise((resolve, reject) => {
    request.on("data", (chunk) => {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufferChunk.length;

      if (totalBytes > maxBytes) {
        reject(new Error("Payload too large. Please upload a smaller CV PDF or TXT file."));
        request.destroy();
        return;
      }

      chunks.push(bufferChunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function parseMultipartResumeUpload(contentType, bodyBuffer) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Upload boundary missing.");
  }

  const body = bodyBuffer.toString("latin1");
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (!part.includes('name="resume"')) continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd);
    const fileNameMatch = headers.match(/filename="([^"]+)"/i);
    const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    let contentStart = headerEnd + 4;
    let contentEnd = part.lastIndexOf("\r\n");
    if (contentEnd < contentStart) contentEnd = part.length;

    const fileContent = part.slice(contentStart, contentEnd);
    const bytes = Buffer.from(fileContent, "latin1");

    return {
      fileName: fileNameMatch?.[1] || "resume-upload",
      mimeType: mimeTypeMatch?.[1] || "application/octet-stream",
      bytes
    };
  }

  throw new Error("No resume file was found in the upload.");
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
        .hidden-field { display:none; }
        .upload-summary { margin-top: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,0.03); }
        .auth-shell { display:grid; gap:20px; }
        .auth-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
        .app-shell.hidden, .auth-shell.hidden { display:none; }
        .user-chip { margin-top:18px; padding:12px; border:1px solid var(--border); border-radius:16px; background:rgba(255,255,255,0.03); }
        @media (max-width:1100px) {
          .shell { grid-template-columns:1fr; }
          .sidebar { position:static; height:auto; }
          .card.half, .card.third { grid-column:span 12; }
          .form-grid { grid-template-columns:1fr; }
          .auth-grid { grid-template-columns:1fr; }
        }
      </style>
    </head>
    <body>
      <div id="auth-shell" class="shell auth-shell">
        <main class="panel content" style="max-width:960px;margin:0 auto;width:100%;">
          <section class="hero">
            <div>
              <h1>Welcome to RoleForge</h1>
              <p>Create a secure account to keep your CV uploads, tailored drafts, and analysis history private to you.</p>
            </div>
          </section>
          <div class="auth-grid">
            <section class="card">
              <h2>Create account</h2>
              <div class="form-grid">
                <input id="signup-name" class="full" placeholder="Full name" />
                <input id="signup-email" placeholder="Email address" />
                <input id="signup-password" type="password" placeholder="Password" />
              </div>
              <div class="action-row">
                <button id="signup-button" type="button">Create account</button>
              </div>
            </section>
            <section class="card">
              <h2>Sign in</h2>
              <div class="form-grid">
                <input id="login-email" placeholder="Email address" />
                <input id="login-password" type="password" placeholder="Password" />
              </div>
              <div class="action-row">
                <button id="login-button" type="button">Sign in</button>
              </div>
            </section>
          </div>
          <section class="card">
            <h2>Private by default</h2>
            <p>Your runs are now tied to your own account. You can only see your own uploads, tailored CV drafts, and cover letters.</p>
            <p id="auth-status" class="muted-small">Create an account or sign in to start.</p>
          </section>
        </main>
      </div>

      <div id="app-shell" class="shell app-shell hidden">
        <aside class="panel sidebar">
          <p class="brand">RoleForge</p>
          <p class="subtle">A focused workspace for improving one application at a time.</p>
          <div class="badge">Application workspace</div>
          <div class="user-chip">
            <div id="user-name" style="font-weight:700;">Signed out</div>
            <div id="user-email" class="muted-small"></div>
            <div class="action-row" style="margin-top:10px;">
              <button id="logout-button" class="ghost" type="button">Sign out</button>
            </div>
          </div>
          <h3 style="margin-top:22px;">Recent runs</h3>
          <div id="run-list" class="run-list"></div>
        </aside>
        <main class="panel content">
          <section class="hero">
            <div>
              <h1>Tailor your CV and cover letter</h1>
              <p>Upload your CV, paste a job description, and get a clearer fit score, a stronger CV draft, and a more personal cover letter.</p>
            </div>
            <div class="badge" id="retrieval-badge" style="display:none;"></div>
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
                <div id="upload-status" class="muted-small" style="margin-top:8px;">Upload a CV to fill in your details automatically.</div>
                <div id="resume-summary" class="upload-summary muted-small">No CV loaded yet.</div>
              </div>
              <textarea id="resume-text" class="hidden-field" aria-hidden="true"></textarea>
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
        const authShell = document.getElementById("auth-shell");
        const appShell = document.getElementById("app-shell");
        const runListEl = document.getElementById("run-list");
        const detailRoot = document.getElementById("detail-root");
        const runStatus = document.getElementById("run-status");
        const uploadStatus = document.getElementById("upload-status");
        const authStatus = document.getElementById("auth-status");
        let activeRunId = null;
        let currentUser = null;

        function section(title, content, className = "card") {
          return \`<section class="\${className}"><h2>\${title}</h2>\${content}</section>\`;
        }

        function pillRow(items) {
          return '<div class="pill-row">' + (items || []).map((item) => \`<span class="pill">\${escapeHtml(item)}</span>\`).join("") + '</div>';
        }

        function setAuthenticatedUser(user) {
          currentUser = user;
          const signedIn = Boolean(user);
          authShell.classList.toggle("hidden", signedIn);
          appShell.classList.toggle("hidden", !signedIn);
          document.getElementById("user-name").textContent = user?.name || "Signed out";
          document.getElementById("user-email").textContent = user?.email || "";
          if (user) {
            if (!document.getElementById("candidate-name").value) {
              document.getElementById("candidate-name").value = user.name;
            }
            if (!document.getElementById("candidate-email").value) {
              document.getElementById("candidate-email").value = user.email;
            }
          }
        }

        async function fetchCurrentUser() {
          const response = await fetch("/me");
          if (!response.ok) {
            setAuthenticatedUser(null);
            return null;
          }

          const payload = await response.json();
          setAuthenticatedUser(payload.user);
          return payload.user;
        }

        async function signUp() {
          authStatus.textContent = "Creating your account...";
          const response = await fetch("/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: document.getElementById("signup-name").value,
              email: document.getElementById("signup-email").value,
              password: document.getElementById("signup-password").value
            })
          });
          const payload = await response.json();
          authStatus.textContent = payload.details || payload.error || "Account created.";
          if (!response.ok) return;
          setAuthenticatedUser(payload.user);
          await loadRuns();
        }

        async function signIn() {
          authStatus.textContent = "Signing you in...";
          const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: document.getElementById("login-email").value,
              password: document.getElementById("login-password").value
            })
          });
          const payload = await response.json();
          authStatus.textContent = payload.details || payload.error || "Signed in.";
          if (!response.ok) return;
          setAuthenticatedUser(payload.user);
          await loadRuns();
        }

        async function signOut() {
          await fetch("/logout", { method: "POST" });
          setAuthenticatedUser(null);
          runListEl.innerHTML = "";
          detailRoot.innerHTML = section("Signed out", "<p>Sign back in to continue your private workspace.</p>");
          authStatus.textContent = "Signed out.";
        }

        async function loadRuns() {
          const response = await fetch("/runs");
          if (response.status === 401) {
            setAuthenticatedUser(null);
            return;
          }
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
          if (response.status === 401) {
            setAuthenticatedUser(null);
            return;
          }
          const run = await response.json();
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
            section("Fit score", \`
              <p><strong>Current fit:</strong> \${run.gap.output.atsScore}/100</p>
              <p><strong>Strong target:</strong> \${run.gap.output.targetAtsScore}/100</p>
              <p><strong>Expected after changes:</strong> \${run.rewrite.output.projectedAtsScore}/100</p>
              <h3>Most important improvements</h3>\${pillRow(run.gap.output.highPriorityFixes)}
            \`, "card third"),
            section("What already matches", \`
              <h3>Your strongest matches</h3>\${pillRow(run.gap.output.strengths)}
              <h3>What this role focuses on</h3>\${pillRow(run.nlp.roleThemes.length ? run.nlp.roleThemes : run.job.output.businessNeeds)}
            \`, "card third"),
            section("What to improve", \`
              <h3>Focus areas</h3>\${pillRow(run.gap.output.focusAreas)}
              <h3>Missing pieces</h3>\${pillRow(run.gap.output.gaps)}
              <ul>\${run.gap.output.applicationStrategy.map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}</ul>
            \`, "card third"),
            section("Cover letter", \`<pre id="cover-letter-output">\${escapeHtml(finalCoverLetter)}</pre>
              <div class="action-row">
                <button type="button" onclick="copyText('cover-letter-output')">Copy cover letter</button>
                <button type="button" class="ghost" onclick="downloadText('cover-letter-output', 'roleforge-cover-letter.txt')">Download cover letter</button>
              </div>\`, "card half"),
            section("Improved CV draft", \`<pre id="resume-artifact-output">\${escapeHtml(finalResumeArtifact)}</pre>
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
          const jobDescription = document.getElementById("job-description").value;
          return {
            candidate: {
              name: document.getElementById("candidate-name").value,
              email: document.getElementById("candidate-email").value,
              resumeText: document.getElementById("resume-text").value
            },
            target: {
              targetRole: document.getElementById("target-role").value || inferRoleFromJobDescription(jobDescription),
              companyName: document.getElementById("company-name").value || inferCompanyFromJobDescription(jobDescription),
              companyWebsite: document.getElementById("company-website").value,
              jobDescription
            }
          };
        }

        function inferRoleFromJobDescription(text) {
          const patterns = [
            /\\b(?:as an?|for an?|position:?|role:?)\\s+([A-Z][A-Za-z /+-]*(?:Engineer|Scientist|Analyst|Developer|Manager|Consultant|Specialist))/i,
            /\\b([A-Z][A-Za-z /+-]*(?:Engineer|Scientist|Analyst|Developer|Manager|Consultant|Specialist))\\b/
          ];
          for (const pattern of patterns) {
            const match = String(text || "").match(pattern);
            if (match?.[1]) return match[1].replace(/\\s+/g, " ").trim();
          }
          return "";
        }

        function inferCompanyFromJobDescription(text) {
          const patterns = [
            /\\bat\\s+([A-Z][A-Za-z0-9&.'-]+)(?:\\s|,|\\.|!)/,
            /\\bjoin\\s+([A-Z][A-Za-z0-9&.'-]+)(?:\\s|,|\\.|!)/i,
            /\\bcompany:\\s*([A-Z][A-Za-z0-9&.' -]+)/i
          ];
          for (const pattern of patterns) {
            const match = String(text || "").match(pattern);
            if (match?.[1]) return match[1].replace(/\\s+/g, " ").trim();
          }
          return "";
        }

        function validatePayload(payload) {
          if (!payload.candidate.resumeText.trim()) return "Upload a CV before running analysis.";
          if (!payload.target.jobDescription.trim()) return "Paste a job description before running analysis.";
          if (!payload.target.targetRole.trim()) return "Add the target role or include it clearly in the job description.";
          return "";
        }

        async function submitRun() {
          const payload = buildPayload();
          const validationError = validatePayload(payload);
          if (validationError) {
            runStatus.textContent = validationError;
            detailRoot.innerHTML = section("Missing information", \`<p>\${escapeHtml(validationError)}</p>\`);
            return;
          }
          document.getElementById("target-role").value = payload.target.targetRole;
          if (payload.target.companyName) document.getElementById("company-name").value = payload.target.companyName;
          runStatus.textContent = "Running agents...";
          const response = await fetch("/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (response.status === 401) {
            setAuthenticatedUser(null);
            runStatus.textContent = "Please sign in again.";
            return;
          }
          const run = await response.json();
          if (!response.ok) {
            runStatus.textContent = run.error || "Run failed.";
            detailRoot.innerHTML = section("Run failed", '<pre>' + escapeHtml(JSON.stringify(run, null, 2)) + '</pre>');
            return;
          }
          runStatus.textContent = "Run completed.";
          activeRunId = run.id;
          renderRunDetail(run);
          await loadRuns();
        }

        function resetComposer() {
          activeRunId = null;
          runStatus.textContent = "Ready.";
          ["candidate-name","candidate-email","target-role","company-name","company-website","resume-text","job-description"].forEach((id) => {
            document.getElementById(id).value = "";
          });
          document.getElementById("resume-file").value = "";
          uploadStatus.textContent = "Upload a CV to fill in your details automatically.";
          document.getElementById("resume-summary").textContent = "No CV loaded yet.";
          detailRoot.innerHTML = section("Fresh workspace", "<p>The form is reset. Recent runs stay in the sidebar, but nothing is carried into your new request automatically.</p>");
        }

        async function handleResumeUpload(event) {
          const file = event.target.files?.[0];
          if (!file) return;
          uploadStatus.textContent = "Reading resume...";
          const formData = new FormData();
          formData.append("resume", file);
          const response = await fetch("/upload-resume", {
            method: "POST",
            body: formData
          });
          if (response.status === 401) {
            setAuthenticatedUser(null);
            uploadStatus.textContent = "Please sign in again.";
            return;
          }
          const payload = await response.json();
          if (!response.ok) {
            uploadStatus.textContent = payload.details || payload.error || "Upload failed.";
            return;
          }
          document.getElementById("resume-text").value = payload.text || "";
          if (payload.guessedName) document.getElementById("candidate-name").value = payload.guessedName;
          if (payload.email) document.getElementById("candidate-email").value = payload.email;
          uploadStatus.textContent = \`Loaded \${file.name}.\`;
          const wordCount = (payload.text || "").split(/\\s+/).filter(Boolean).length;
          document.getElementById("resume-summary").textContent =
            \`\${file.name} loaded. Extracted \${wordCount} words\${payload.guessedName ? \`, detected \${payload.guessedName}\` : ""}\${payload.email ? \`, detected \${payload.email}\` : ""}.\`;
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
        document.getElementById("signup-button").addEventListener("click", signUp);
        document.getElementById("login-button").addEventListener("click", signIn);
        document.getElementById("logout-button").addEventListener("click", signOut);

        async function bootstrap() {
          const user = await fetchCurrentUser();
          if (user) {
            authStatus.textContent = "";
            await loadRuns();
          }
        }

        bootstrap();
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

  const originError = validateOrigin(request);
  if (originError) {
    return json(response, 403, originError);
  }

  const authenticatedUser = await getAuthenticatedUser(request);

  if (request.method === "OPTIONS") {
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { status: "ok" });
  }

  if (request.method === "GET" && request.url === "/ready") {
    return json(response, 200, { status: "ready" });
  }

  if (request.method === "GET" && request.url === "/") {
    return html(response, 200, renderConsoleApp());
  }

  if (request.method === "GET" && request.url === "/me") {
    if (!authenticatedUser) {
      return unauthorized(response);
    }
    return json(response, 200, { user: authenticatedUser });
  }

  if (request.method === "POST" && request.url === "/signup") {
    const limited = enforceRateLimit(request, "auth");
    if (limited) return json(response, 429, limited);
    try {
      const payload = await readJsonBody(request);
      const user = await registerUser(payload.name, payload.email, payload.password);
      const token = await createSession(user.id);
      attachCookie(response, buildSessionCookie(token));
      return json(response, 200, { user, details: "Account created. You are now signed in." });
    } catch (error) {
      return json(response, 400, {
        error: "Sign-up failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "POST" && request.url === "/login") {
    const limited = enforceRateLimit(request, "auth");
    if (limited) return json(response, 429, limited);
    try {
      const payload = await readJsonBody(request);
      const user = await authenticateUser(payload.email, payload.password);
      const token = await createSession(user.id);
      attachCookie(response, buildSessionCookie(token));
      return json(response, 200, { user, details: "Signed in successfully." });
    } catch (error) {
      return json(response, 400, {
        error: "Sign-in failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "POST" && request.url === "/logout") {
    const token = parseCookies(request)[SESSION_COOKIE];
    await revokeSession(token);
    attachCookie(response, buildExpiredSessionCookie());
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url === "/runs") {
    const limited = enforceRateLimit(request, "read");
    if (limited) return json(response, 429, limited);
    if (!authenticatedUser) {
      return unauthorized(response);
    }
    return json(response, 200, await listRuns(authenticatedUser.id));
  }

  if (request.method === "GET" && request.url === "/console") {
    return html(response, 200, renderConsoleApp());
  }

  if (request.method === "GET" && request.url.startsWith("/runs/")) {
    const limited = enforceRateLimit(request, "read");
    if (limited) return json(response, 429, limited);
    if (!authenticatedUser) {
      return unauthorized(response);
    }
    try {
      return json(response, 200, await loadRun(request.url.split("/").pop() || "", authenticatedUser.id));
    } catch (error) {
      return json(response, 404, { error: "Run not found", details: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  if (request.method === "GET" && request.url.startsWith("/console/")) {
    if (!authenticatedUser) {
      return html(response, 401, `<h1>Sign in required</h1><p>Please return to the main app and sign in.</p>`);
    }
    try {
      return html(response, 200, renderRunDetail(await loadRun(request.url.split("/").pop() || "", authenticatedUser.id)));
    } catch (error) {
      return html(response, 404, `<h1>Run not found</h1><p>${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p>`);
    }
  }

  if (request.method === "POST" && request.url === "/run") {
    const limited = enforceRateLimit(request, "run");
    if (limited) return json(response, 429, limited);
    if (!authenticatedUser) {
      return unauthorized(response);
    }
    try {
      const payload = await readJsonBody(request);
      const normalized = normalizeRunPayload(payload);
      const result = await runRoleForge({
        ...normalized,
        auth: {
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          name: authenticatedUser.name
        }
      });
      return json(response, 200, result);
    } catch (error) {
      return json(response, 400, {
        error: "Invalid request",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "POST" && request.url === "/upload-resume") {
    const limited = enforceRateLimit(request, "upload");
    if (limited) return json(response, 429, limited);
    if (!authenticatedUser) {
      return unauthorized(response);
    }
    try {
      const contentType = String(request.headers["content-type"] || "");
      let result;

      if (contentType.includes("multipart/form-data")) {
        const bodyBuffer = await readRawBody(request);
        const upload = parseMultipartResumeUpload(contentType, bodyBuffer);
        result = await extractResumeTextFromPayload(
          upload.fileName,
          upload.mimeType,
          upload.bytes.toString("base64")
        );
      } else {
        const payload = await readJsonBody(request);
        result = await extractResumeTextFromPayload(
          payload.fileName,
          payload.mimeType,
          payload.base64
        );
      }

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
