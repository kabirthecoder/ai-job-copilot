import { extractPackagingInfo } from "./agents/packaging-extractor.js";
import { analyzeVisualAuthenticity } from "./agents/visual-analyzer.js";
import { generateVerdict, buildVerificationGuidance } from "./agents/verdict-agent.js";
import { lookupDrug } from "./services/fda-api.js";
import { checkWHOAlerts } from "./services/who-checker.js";
import { checkGlobalRegistries } from "./services/global-registries.js";
import { buildEncyclopedia } from "./services/medicine-encyclopedia.js";
import { inferCountry, getAuthority } from "./services/regulatory-lookup.js";
import { languageInstruction } from "./services/i18n.js";
import type { AnalysisResult } from "./types.js";

const DISCLAIMER_BY_LANG: Record<string, string> = {
  en: "This analysis is powered by AI and cross-referenced against FDA, WHO, and Health Canada databases. It is for informational purposes only. If you suspect a counterfeit medicine, DO NOT USE IT — report to your national medicines regulatory authority immediately.",
  hi: "यह विश्लेषण AI द्वारा संचालित है और FDA, WHO, और Health Canada डेटाबेस के विरुद्ध जांचा गया है। यह केवल सूचना के लिए है। यदि आपको नकली दवाई का संदेह है, तो इसका उपयोग न करें — तुरंत अपने राष्ट्रीय दवा नियामक प्राधिकरण को रिपोर्ट करें।",
  fr: "Cette analyse est alimentée par l'IA et vérifiée par rapport aux bases de données FDA, OMS et Santé Canada. Elle est fournie à titre informatif uniquement. Si vous suspectez un médicament contrefait, NE L'UTILISEZ PAS — signalez-le immédiatement à votre autorité nationale de réglementation des médicaments.",
  sw: "Uchambuzi huu unaendeshwa na AI na unapiganishwa na hifadhidata za FDA, WHO, na Health Canada. Ni kwa madhumuni ya habari tu. Ukishuku dawa bandia, USITUMIE — ripoti kwa mamlaka ya udhibiti wa dawa ya taifa lako mara moja.",
  ar: "هذا التحليل مدعوم بالذكاء الاصطناعي ومرجع مع قواعد بيانات FDA وWHO وHealth Canada. هو لأغراض إعلامية فقط. إذا كنت تشك في دواء مزيف، لا تستخدمه — أبلغ السلطة التنظيمية الدوائية الوطنية فورًا.",
  ha: "Wannan bincike yana amfani da AI kuma an kwatanta shi da bayanan FDA, WHO, da Health Canada. Yana don dalilai na bayanai kawai. Idan kana zargin magani na karya, KADA KA YI AMFANI DA SHI — rarraba zuwa hukumar magungunan ƙasa ka nan take.",
  ur: "یہ تجزیہ AI سے تقویت یافتہ ہے اور FDA، WHO، اور Health Canada ڈیٹا بیس کے خلاف حوالہ دیا گیا ہے۔ یہ صرف معلوماتی مقاصد کے لیے ہے۔ اگر آپ کو جعلی دوائی کا شبہ ہو تو اسے استعمال نہ کریں — فوری طور پر اپنی قومی ادویاتی ریگولیٹری اتھارٹی کو رپورٹ کریں۔",
  bn: "এই বিশ্লেষণ AI দ্বারা পরিচালিত এবং FDA, WHO এবং Health Canada ডেটাবেসের বিপরীতে যাচাই করা হয়েছে। এটি শুধুমাত্র তথ্যমূলক উদ্দেশ্যে। যদি আপনি নকল ওষুধের সন্দেহ করেন, ব্যবহার করবেন না — অবিলম্বে আপনার জাতীয় ওষুধ নিয়ন্ত্রক কর্তৃপক্ষকে রিপোর্ট করুন।",
  id: "Analisis ini didukung oleh AI dan diverifikasi terhadap database FDA, WHO, dan Health Canada. Hanya untuk tujuan informasi. Jika Anda mencurigai obat palsu, JANGAN GUNAKAN — laporkan ke otoritas regulasi obat nasional Anda segera.",
};

export async function analyzeMedicine(
  imageBuffer: Buffer,
  mimeType: string,
  languageCode = "en"
): Promise<AnalysisResult> {
  const langNote = languageInstruction(languageCode);

  console.log(`[1/3] Extracting packaging (lang: ${languageCode})...`);
  const packaging = await extractPackagingInfo(imageBuffer, mimeType);
  console.log(`      → Drug: "${packaging.drugName}" | Mfr: "${packaging.manufacturer}"`);

  console.log("[2/3] Running parallel lookups + visual analysis...");
  const [fdaRecord, whoAlert, visualAnalysis] = await Promise.all([
    lookupDrug(packaging.drugName),
    Promise.resolve(checkWHOAlerts(packaging.drugName, packaging.manufacturer, packaging.batchNumber)),
    analyzeVisualAuthenticity(imageBuffer, mimeType, packaging.drugName),
  ]);

  console.log(`      → FDA: ${fdaRecord.found ? "✓" : "✗"}, Recalls: ${fdaRecord.recalls.length}, WHO: ${whoAlert ? `⚠ ${whoAlert.id}` : "none"}`);
  console.log(`      → Visual: ${visualAnalysis.overallQuality} (${visualAnalysis.printQualityScore}/100)`);

  const [globalRegistries, encyclopedia] = await Promise.all([
    checkGlobalRegistries(packaging.drugName, fdaRecord.found),
    buildEncyclopedia(packaging.drugName, fdaRecord, langNote),
  ]);

  // Infer which country/authority is relevant
  const authority = inferCountry(packaging.countryOfOrigin, packaging.languagesDetected);

  console.log("[3/3] Generating verdict...");
  const verdict = await generateVerdict(packaging, fdaRecord, whoAlert, visualAnalysis, langNote);
  console.log(`      → ${verdict.verdict.toUpperCase()} (${verdict.score}/100)`);

  const verificationGuidance = buildVerificationGuidance(packaging, verdict, authority);
  const disclaimer = DISCLAIMER_BY_LANG[languageCode] ?? DISCLAIMER_BY_LANG.en;

  return {
    packaging,
    fdaRecord,
    whoAlertMatch: whoAlert,
    globalRegistries,
    visualAnalysis,
    verdict,
    encyclopedia,
    verificationGuidance,
    disclaimer,
  };
}
