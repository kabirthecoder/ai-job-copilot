/**
 * WhatsApp bot via Twilio WhatsApp Business API.
 *
 * Setup:
 *   1. Sign up at twilio.com, enable WhatsApp Sandbox or Business API
 *   2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER in .env
 *   3. Set your webhook URL to: https://your-domain.com/api/whatsapp
 *
 * Test with Twilio Sandbox — free, no approval needed:
 *   Send "join <sandbox-keyword>" from WhatsApp to +1 415 523 8886
 */

import { analyzeMedicine } from "../orchestrator.js";
import {
  detectLanguageFromText,
  welcomeMessage,
  formatWhatsAppVerdict,
  SUPPORTED_LANGUAGES,
} from "./i18n.js";
import { inferCountry } from "./regulatory-lookup.js";

// In-memory language preference per user (phone number → language code)
// In production: replace with Redis or a database
const userLangMap = new Map<string, string>();
const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

async function downloadTwilioMedia(mediaUrl: string): Promise<Buffer> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Failed to download media: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER ?? "whatsapp:+14155238886";

  if (!sid || !token) {
    console.warn("Twilio credentials not set — skipping WhatsApp reply");
    return;
  }

  const params = new URLSearchParams({ From: from, To: to, Body: body });

  await fetch(`${TWILIO_BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

/** Main handler — called from the Express route */
export async function handleWhatsAppWebhook(
  body: Record<string, string>
): Promise<void> {
  const from: string = body.From ?? "";
  const messageBody: string = body.Body ?? "";
  const mediaUrl: string | undefined = body.MediaUrl0;
  const mediaType: string | undefined = body.MediaContentType0;
  const numMedia = parseInt(body.NumMedia ?? "0", 10);

  if (!from) return;

  // ── Language change request ──
  const detectedLang = detectLanguageFromText(messageBody);
  if (detectedLang && numMedia === 0) {
    userLangMap.set(from, detectedLang);
    const lang = SUPPORTED_LANGUAGES[detectedLang];
    await sendWhatsAppMessage(
      from,
      `✅ Language set to *${lang.native}* (${lang.name})\n\nNow send a photo of your medicine packaging.`
    );
    return;
  }

  // ── Help / greeting ──
  const greetings = /\b(hi|hello|help|start|hola|bonjour|salut|habari|مرحبا|नमस्ते|হ্যালো)\b/i;
  if (numMedia === 0 && (greetings.test(messageBody) || messageBody.trim().length < 3)) {
    const langCode = userLangMap.get(from) ?? "en";
    await sendWhatsAppMessage(from, welcomeMessage(langCode));
    return;
  }

  // ── Medicine image received ──
  if (numMedia > 0 && mediaUrl && mediaType) {
    const langCode = userLangMap.get(from) ?? "en";

    // Tell user analysis is starting
    const thinkingMessages: Record<string, string> = {
      en: "🔍 Analyzing your medicine... This takes about 20–30 seconds.",
      hi: "🔍 आपकी दवाई की जांच हो रही है... इसमें लगभग 20-30 सेकंड लगेंगे।",
      fr: "🔍 Analyse de votre médicament en cours... Cela prend environ 20-30 secondes.",
      sw: "🔍 Ninachunguza dawa yako... Hii inachukua sekunde 20-30.",
      ar: "🔍 جاري تحليل دوائك... يستغرق ذلك حوالي 20-30 ثانية.",
      ha: "🔍 Ina duba magani naka... Wannan yana ɗaukar kimanin dakika 20-30.",
      ur: "🔍 آپ کی دوائی کا تجزیہ ہو رہا ہے... اس میں تقریباً 20-30 سیکنڈ لگیں گے۔",
      bn: "🔍 আপনার ওষুধ বিশ্লেষণ করা হচ্ছে... এতে প্রায় 20-30 সেকেন্ড সময় লাগবে।",
      id: "🔍 Menganalisis obat Anda... Ini membutuhkan sekitar 20-30 detik.",
    };
    await sendWhatsAppMessage(from, thinkingMessages[langCode] ?? thinkingMessages.en);

    try {
      const imageBuffer = await downloadTwilioMedia(mediaUrl);

      // Normalize mime type
      const mime = mediaType === "image/jpg" ? "image/jpeg" : mediaType;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
        await sendWhatsAppMessage(
          from,
          "❌ Please send a JPEG or PNG photo of the medicine packaging."
        );
        return;
      }

      const result = await analyzeMedicine(imageBuffer, mime, langCode);

      // Find regulatory authority
      const authority = inferCountry(
        result.packaging.countryOfOrigin,
        result.packaging.languagesDetected
      );

      const message = formatWhatsAppVerdict(
        result.packaging.drugName,
        result.verdict.score,
        result.verdict.verdict,
        result.verdict.immediateAction,
        result.verdict.detailedExplanation,
        result.verdict.redFlags.length,
        result.encyclopedia.isWHOEssential,
        result.whoAlertMatch?.id ?? null,
        authority?.country ?? "",
        authority?.hotline ?? null,
        langCode
      );

      await sendWhatsAppMessage(from, message);

      // Send encyclopedia as a second message (drug info)
      const enc = result.encyclopedia;
      const encMsg = [
        `📖 *About ${enc.drugName}*`,
        ``,
        enc.whatIsIt,
        ``,
        `🔬 *How it works:* ${enc.mechanismOfAction}`,
        ``,
        `✅ *Uses:* ${enc.medicalUses.slice(0, 4).join(" · ")}`,
        enc.isWHOEssential ? `🌍 *WHO Essential Medicine* — ${enc.essentialMedicineCategory}` : "",
        ``,
        `⚠️ *Key warning:* ${enc.keyWarnings[0] ?? "Consult a doctor before use"}`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendWhatsAppMessage(from, encMsg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed";
      console.error("WhatsApp analysis error:", errMsg);
      await sendWhatsAppMessage(
        from,
        `❌ Analysis failed: ${errMsg}\n\nPlease send a clearer photo showing the full packaging.`
      );
    }
    return;
  }

  // ── Fallback ──
  const langCode = userLangMap.get(from) ?? "en";
  await sendWhatsAppMessage(from, welcomeMessage(langCode));
}
