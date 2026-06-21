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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

// Security & performance middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan("combined"));
app.use(express.json());

// Rate limit: 20 analyses per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes before trying again." },
});

// Multer — accept images up to 20MB in memory (no disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are accepted (JPEG, PNG, WebP)."));
    }
  },
});

app.use(express.static(join(__dirname, "../public")));

app.post(
  "/api/analyze",
  limiter,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image uploaded. Please select a photo of the medicine packaging." });
      return;
    }

    const mimeType = req.file.mimetype === "image/jpg" ? "image/jpeg" : req.file.mimetype;

    try {
      console.log(`Analyzing ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB, ${mimeType})`);
      const result = await analyzeMedicine(req.file.buffer, mimeType);
      res.json({ success: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      console.error("Analysis error:", message);
      res.status(500).json({ error: message });
    }
  }
);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    capabilities: ["image-analysis", "fda-lookup", "who-alerts", "visual-forensics"],
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Medicine Detector running at http://localhost:${PORT}`);
});
