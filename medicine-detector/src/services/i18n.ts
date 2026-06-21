// Language detection and multilingual response generation.
// Claude speaks every language natively — we route output language, not translate after.

export const SUPPORTED_LANGUAGES: Record<string, { name: string; native: string; flag: string; regions: string[] }> = {
  en:  { name: "English",    native: "English",       flag: "🌐", regions: ["Global", "US", "UK", "India", "Nigeria", "Kenya"] },
  hi:  { name: "Hindi",      native: "हिंदी",           flag: "🇮🇳", regions: ["India"] },
  bn:  { name: "Bengali",    native: "বাংলা",           flag: "🇧🇩", regions: ["Bangladesh", "India"] },
  ur:  { name: "Urdu",       native: "اردو",            flag: "🇵🇰", regions: ["Pakistan", "India"] },
  id:  { name: "Indonesian", native: "Bahasa Indonesia",flag: "🇮🇩", regions: ["Indonesia"] },
  fr:  { name: "French",     native: "Français",        flag: "🇫🇷", regions: ["West Africa", "DRC", "Cameroon", "Senegal"] },
  sw:  { name: "Swahili",    native: "Kiswahili",       flag: "🌍", regions: ["Kenya", "Tanzania", "Uganda", "Rwanda"] },
  ha:  { name: "Hausa",      native: "Hausa",           flag: "🌍", regions: ["Nigeria", "Niger", "Ghana", "Chad"] },
  ar:  { name: "Arabic",     native: "العربية",         flag: "🌍", regions: ["Egypt", "Sudan", "North Africa"] },
  vi:  { name: "Vietnamese", native: "Tiếng Việt",      flag: "🇻🇳", regions: ["Vietnam"] },
  my:  { name: "Burmese",    native: "မြန်မာဘာသာ",     flag: "🇲🇲", regions: ["Myanmar"] },
  tl:  { name: "Filipino",   native: "Filipino",        flag: "🇵🇭", regions: ["Philippines"] },
  th:  { name: "Thai",       native: "ภาษาไทย",         flag: "🇹🇭", regions: ["Thailand"] },
  ms:  { name: "Malay",      native: "Bahasa Melayu",   flag: "🇲🇾", regions: ["Malaysia", "Indonesia"] },
  yo:  { name: "Yoruba",     native: "Yorùbá",          flag: "🇳🇬", regions: ["Nigeria", "Benin"] },
  am:  { name: "Amharic",    native: "አማርኛ",            flag: "🇪🇹", regions: ["Ethiopia"] },
  pt:  { name: "Portuguese", native: "Português",       flag: "🇧🇷", regions: ["Brazil", "Angola", "Mozambique"] },
  zh:  { name: "Chinese",    native: "中文",             flag: "🇨🇳", regions: ["China", "Taiwan", "Singapore"] },
  km:  { name: "Khmer",      native: "ភាសាខ្មែរ",       flag: "🇰🇭", regions: ["Cambodia"] },
};

const LANG_KEYWORDS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(hindi|हिंदी|हिन्दी)\b/i,                            code: "hi" },
  { pattern: /\b(bengali|bangla|বাংলা)\b/i,                          code: "bn" },
  { pattern: /\b(urdu|اردو)\b/i,                                      code: "ur" },
  { pattern: /\b(indonesian|bahasa|indo)\b/i,                         code: "id" },
  { pattern: /\b(french|français|francais|fr)\b/i,                    code: "fr" },
  { pattern: /\b(swahili|kiswahili)\b/i,                              code: "sw" },
  { pattern: /\b(hausa)\b/i,                                          code: "ha" },
  { pattern: /\b(arabic|عربي|عربية)\b/i,                              code: "ar" },
  { pattern: /\b(vietnamese|tiếng việt|viet)\b/i,                    code: "vi" },
  { pattern: /\b(burmese|myanmar|မြန်မာ)\b/i,                        code: "my" },
  { pattern: /\b(filipino|tagalog|pilipino)\b/i,                      code: "tl" },
  { pattern: /\b(thai|ภาษาไทย)\b/i,                                   code: "th" },
  { pattern: /\b(malay|melayu)\b/i,                                   code: "ms" },
  { pattern: /\b(yoruba|yorùbá)\b/i,                                  code: "yo" },
  { pattern: /\b(amharic|አማርኛ)\b/i,                                  code: "am" },
  { pattern: /\b(portuguese|português|portugues)\b/i,                 code: "pt" },
  { pattern: /\b(chinese|mandarin|中文|普通话)\b/i,                   code: "zh" },
  { pattern: /\b(khmer|cambodian|ភាសាខ្មែរ)\b/i,                    code: "km" },
  { pattern: /\b(english|eng)\b/i,                                    code: "en" },
];

/** Detect language code from a user message (e.g. WhatsApp text) */
export function detectLanguageFromText(text: string): string | null {
  for (const { pattern, code } of LANG_KEYWORDS) {
    if (pattern.test(text)) return code;
  }
  return null;
}

/** Map browser Accept-Language header or navigator.language to our codes */
export function mapBrowserLocale(locale: string): string {
  const base = locale.split("-")[0].toLowerCase();
  return SUPPORTED_LANGUAGES[base] ? base : "en";
}

/** Get language instruction for Claude — append to any system prompt */
export function languageInstruction(code: string): string {
  const lang = SUPPORTED_LANGUAGES[code];
  if (!lang || code === "en") return "";
  return `\n\nIMPORTANT: Write your ENTIRE response in ${lang.name} (${lang.native}). Do not use English anywhere in your response except for medicine names, brand names, chemical names, and regulatory authority acronyms which should remain in their original form.`;
}

/** Format a WhatsApp welcome message in a given language */
export function welcomeMessage(code: string): string {
  const messages: Record<string, string> = {
    en: "👋 Welcome to *MediVerify* — AI Medicine Scanner\n\n📷 Send me a clear photo of your medicine packaging (front + back if possible) and I'll tell you if it's *REAL or FAKE*.\n\nI'll check against:\n• FDA drug database 🇺🇸\n• WHO counterfeit alerts 🌍\n• Health Canada 🇨🇦\n• Visual forensic analysis 🔬\n\n💬 Reply with your language to change:\n_English / Hindi / French / Swahili / Arabic / Hausa / Urdu / Bengali / Indonesian_",
    hi: "👋 *MediVerify* में आपका स्वागत है — AI दवाई जांच\n\n📷 अपनी दवाई की पैकेजिंग की साफ फोटो भेजें और मैं बताऊंगा कि यह *असली है या नकली*।\n\n✅ मैं जांच करूंगा:\n• FDA दवाई डेटाबेस\n• WHO नकली दवाई अलर्ट\n• दृश्य फोरेंसिक विश्लेषण",
    fr: "👋 Bienvenue sur *MediVerify* — Scanner de médicaments IA\n\n📷 Envoyez-moi une photo claire de l'emballage de votre médicament et je vous dirai s'il est *VRAI ou FAUX*.\n\n✅ Je vérifie contre:\n• Base de données FDA\n• Alertes OMS sur les contrefaçons\n• Analyse visuelle forensique",
    sw: "👋 Karibu *MediVerify* — Skana ya Dawa ya AI\n\n📷 Niambie picha wazi ya ufungaji wa dawa yako na nitakuambia kama ni *HALISI au BANDIA*.\n\n✅ Nitaangalia:\n• Hifadhidata ya FDA\n• Tahadhari za WHO za dawa bandia\n• Uchambuzi wa kuona wa forensiki",
    ar: "👋 مرحبًا بك في *MediVerify* — فاحص الأدوية بالذكاء الاصطناعي\n\n📷 أرسل لي صورة واضحة لعبوة دوائك وسأخبرك إذا كانت *حقيقية أم مزيفة*.\n\n✅ سأتحقق من:\n• قاعدة بيانات FDA\n• تنبيهات منظمة الصحة العالمية للأدوية المزيفة\n• التحليل الجنائي البصري",
    ha: "👋 Barka da zuwa *MediVerify* — AI Mai Duba Magani\n\n📷 Aika min hoton rufin magani naka mai kyau kuma zan gaya maka ko *AINIHI ne ko NA KARYA*.\n\n✅ Zan duba:\n• Bayanan magungunan FDA\n• Gargaɗin WHO na magungunan jabu\n• Binciken gani na forensic",
    ur: "👋 *MediVerify* میں خوش آمدید — AI دوائی اسکینر\n\n📷 اپنی دوائی کی پیکنگ کی واضح تصویر بھیجیں اور میں بتاؤں گا کہ یہ *اصلی ہے یا نقلی*۔\n\n✅ میں جانچوں گا:\n• FDA دوائی ڈیٹا بیس\n• WHO جعلی دوائی الرٹس\n• بصری فرانزک تجزیہ",
    bn: "👋 *MediVerify*-তে স্বাগতম — AI ওষুধ স্ক্যানার\n\n📷 আপনার ওষুধের প্যাকেজিংয়ের একটি স্পষ্ট ছবি পাঠান এবং আমি বলব এটি *আসল না নকল*।\n\n✅ আমি যাচাই করব:\n• FDA ওষুধ ডেটাবেস\n• WHO জাল ওষুধ সতর্কতা\n• দৃশ্যমান ফরেনসিক বিশ্লেষণ",
    id: "👋 Selamat datang di *MediVerify* — Pemindai Obat AI\n\n📷 Kirim foto kemasan obat Anda yang jelas dan saya akan memberi tahu apakah obat itu *ASLI atau PALSU*.\n\n✅ Saya akan memeriksa:\n• Database obat FDA\n• Peringatan obat palsu WHO\n• Analisis forensik visual",
  };
  return messages[code] ?? messages.en;
}

/** Format result as a WhatsApp-formatted message in a given language */
export function formatWhatsAppVerdict(
  drugName: string,
  score: number,
  verdict: string,
  immediateAction: string,
  explanation: string,
  redFlagCount: number,
  isWHOEssential: boolean,
  whoAlertId: string | null,
  country: string,
  hotline: string | null,
  langCode: string
): string {
  const verdictEmoji: Record<string, string> = {
    authentic: "✅", "likely-authentic": "✅",
    suspicious: "⚠️",
    "likely-counterfeit": "🚨", counterfeit: "🚫",
  };
  const emoji = verdictEmoji[verdict] ?? "❓";
  const verdictUpper = verdict.replace(/-/g, " ").toUpperCase();

  const lines = [
    `💊 *${drugName}*`,
    ``,
    `${emoji} *${verdictUpper}*`,
    `📊 Authenticity Score: *${score}/100*`,
    ``,
    `📋 ${immediateAction}`,
    ``,
    explanation.split("\n")[0], // First paragraph only for WhatsApp
    ``,
  ];

  if (whoAlertId) {
    lines.push(`⚠️ *WHO ALERT MATCH: ${whoAlertId}*`);
    lines.push(``);
  }

  if (redFlagCount > 0) {
    lines.push(`🚩 ${redFlagCount} red flag(s) detected`);
  }

  if (isWHOEssential) {
    lines.push(`🌍 WHO Essential Medicine`);
  }

  lines.push(``);
  if (country && hotline) {
    lines.push(`📞 *Report to: ${country}* — ${hotline}`);
    lines.push(``);
  }

  lines.push(`_Full analysis: mediverify.app_`);
  lines.push(`_⚠️ AI analysis — consult a pharmacist for confirmation_`);

  return lines.join("\n");
}
