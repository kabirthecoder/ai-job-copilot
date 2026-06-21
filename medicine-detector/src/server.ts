import "dotenv/config";
import express from "express";
import multer from "multer";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { analyzeMedicine } from "./orchestrator.js";
import { handleWhatsAppWebhook } from "./services/whatsapp.js";
import { mapBrowserLocale, SUPPORTED_LANGUAGES } from "./services/i18n.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // required for Twilio webhook

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before trying again." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, or WebP images are accepted."));
  },
});

app.use(express.static(join(__dirname, "../public")));

// ── Web UI analysis endpoint ──
app.post("/api/analyze", limiter, upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image uploaded. Please select a photo of the medicine packaging." });
    return;
  }

  // Language from Accept-Language header or explicit query param
  const langParam = (req.query.lang as string) ?? "";
  const acceptLang = req.headers["accept-language"] ?? "";
  const langCode = SUPPORTED_LANGUAGES[langParam]
    ? langParam
    : mapBrowserLocale(acceptLang);

  const mime = req.file.mimetype === "image/jpg" ? "image/jpeg" : req.file.mimetype;

  try {
    console.log(`Analyzing ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) lang=${langCode}`);
    const result = await analyzeMedicine(req.file.buffer, mime, langCode);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("Analysis error:", message);
    res.status(500).json({ error: message });
  }
});

// ── WhatsApp webhook (Twilio) ──
app.post("/api/whatsapp", async (req, res) => {
  // Respond 200 immediately — Twilio requires fast ACK
  res.status(200).send("<?xml version='1.0' encoding='UTF-8'?><Response></Response>");
  try {
    await handleWhatsAppWebhook(req.body as Record<string, string>);
  } catch (err) {
    console.error("WhatsApp webhook error:", err instanceof Error ? err.message : err);
  }
});

// ── Languages list ──
app.get("/api/languages", (_req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "2.0.0",
    whatsappEnabled: !!(process.env.TWILIO_ACCOUNT_SID),
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES).length,
    capabilities: ["image-analysis", "fda-lookup", "who-alerts", "health-canada", "encyclopedia", "multilingual", "whatsapp-bot"],
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`MediVerify running at http://localhost:${PORT}`);
  if (process.env.TWILIO_ACCOUNT_SID) {
    console.log(`WhatsApp bot active — webhook: POST /api/whatsapp`);
  } else {
    console.log(`WhatsApp bot: set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to enable`);
  }
});
