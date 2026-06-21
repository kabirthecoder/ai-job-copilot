import "dotenv/config";
import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { analyzeEvictionNotice } from "./orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(join(__dirname, "../public")));

app.post("/api/analyze", async (req, res) => {
  const { noticeText } = req.body as { noticeText?: string };

  if (!noticeText || noticeText.trim().length < 50) {
    res.status(400).json({ error: "Please provide the full text of your eviction notice." });
    return;
  }

  try {
    const result = await analyzeEvictionNotice(noticeText.trim());
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("Analysis error:", message);
    res.status(500).json({ error: message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", supported_states: ["California", "New York", "Texas"] });
});

app.listen(PORT, () => {
  console.log(`Eviction Defense Agent running at http://localhost:${PORT}`);
});
