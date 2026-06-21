import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import NodeCache from "node-cache";
import { callClaudeJSON } from "../llm.js";
import type { MedicineEncyclopedia, FDADrugRecord } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = new NodeCache({ stdTTL: 86400 }); // cache 24 hours

const essentialData = JSON.parse(
  readFileSync(join(__dirname, "../data/who-essential-medicines.json"), "utf-8")
) as { medicines: Array<{ names: string[]; category: string; sinceYear: number }> };

function isWHOEssential(drugName: string): { essential: boolean; category?: string } {
  const norm = drugName.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  for (const med of essentialData.medicines) {
    for (const n of med.names) {
      if (norm.includes(n) || n.includes(norm)) {
        return { essential: true, category: med.category };
      }
    }
  }
  return { essential: false };
}

// --- Wikipedia REST API ---
interface WikiSummary {
  title: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source: string };
}

async function fetchWikipedia(drugName: string): Promise<WikiSummary | null> {
  const attempts = [
    drugName,
    drugName.toLowerCase(),
    drugName.replace(/\s+/g, "_"),
    `${drugName} (medication)`,
    `${drugName} (drug)`,
  ];
  for (const term of attempts) {
    const cacheKey = `wiki:${term}`;
    const cached = cache.get<WikiSummary | null>(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = (await res.json()) as WikiSummary;
        if (data.extract) {
          cache.set(cacheKey, data);
          return data;
        }
      }
    } catch {
      // try next attempt
    }
  }
  return null;
}

// --- PubChem API ---
interface PubChemCIDs { IdentifierList?: { CID: number[] } }
interface PubChemProps {
  PropertyTable?: {
    Properties?: Array<{ MolecularFormula?: string; IUPACName?: string }>;
  };
}
interface PubChemDesc {
  InformationList?: {
    Information?: Array<{ Description?: string; DescriptionSourceName?: string }>;
  };
}

async function fetchPubChem(drugName: string): Promise<{
  cid?: number;
  formula?: string;
  iupac?: string;
  description?: string;
} | null> {
  const cacheKey = `pubchem:${drugName}`;
  const cached = cache.get<ReturnType<typeof fetchPubChem> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached !== undefined) return cached as Awaited<ReturnType<typeof fetchPubChem>>;

  try {
    const cidRes = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!cidRes.ok) return null;
    const cidData = (await cidRes.json()) as PubChemCIDs;
    const cid = cidData?.IdentifierList?.CID?.[0];
    if (!cid) return null;

    const [propsRes, descRes] = await Promise.all([
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName/JSON`, {
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`, {
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const props = propsRes.ok ? ((await propsRes.json()) as PubChemProps) : null;
    const desc = descRes.ok ? ((await descRes.json()) as PubChemDesc) : null;

    const prop = props?.PropertyTable?.Properties?.[0];
    const descText = desc?.InformationList?.Information?.find((i) => i.Description)?.Description;

    const result = {
      cid,
      formula: prop?.MolecularFormula,
      iupac: prop?.IUPACName,
      description: descText,
    };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

const SYNTH_SYSTEM = `You are a medical encyclopedia writer creating accurate, clear drug information for the general public.
Write in plain English — informative but not overly technical. Use active voice.
Base your writing ONLY on the provided source data. Do not invent details.`;

export async function buildEncyclopedia(
  drugName: string,
  fdaRecord: FDADrugRecord,
  langNote = ""
): Promise<MedicineEncyclopedia> {
  const cacheKey = `enc:${drugName.toLowerCase()}`;
  const cached = cache.get<MedicineEncyclopedia>(cacheKey);
  if (cached) return cached;

  const [wiki, pubchem] = await Promise.all([
    fetchWikipedia(drugName),
    fetchPubChem(drugName),
  ]);

  const { essential, category } = isWHOEssential(drugName);

  const synthesis = await callClaudeJSON<{
    whatIsIt: string;
    discoveryAndHistory: string;
    medicalUses: string[];
    mechanismOfAction: string;
    commonBrandNames: string[];
    keyWarnings: string[];
    sideEffects: string[];
    interestingFacts: string[];
  }>(
    SYNTH_SYSTEM + langNote,
    `Create a medicine encyclopedia entry for "${drugName}" using ONLY this source data.

WIKIPEDIA EXTRACT:
${wiki?.extract ?? "Not available"}

PUBCHEM DESCRIPTION:
${pubchem?.description ?? "Not available"}
MOLECULAR FORMULA: ${pubchem?.formula ?? "Unknown"}

FDA LABEL DATA:
- Generic name: ${fdaRecord.genericName ?? "Unknown"}
- Dosage forms: ${fdaRecord.dosageForms.join(", ") || "Unknown"}
- Active ingredients: ${fdaRecord.activeIngredients.join(", ") || "Unknown"}
- Manufacturers: ${fdaRecord.manufacturers.slice(0, 3).join(", ") || "Unknown"}
- Indications: ${fdaRecord.indications?.slice(0, 500) ?? "Not available"}
- Warnings: ${fdaRecord.warnings?.slice(0, 500) ?? "Not available"}

WHO ESSENTIAL MEDICINE: ${essential ? `Yes — category: ${category}` : "No"}

Return this JSON (every string must be in plain English, no medical jargon where possible):
{
  "whatIsIt": "2-3 sentence explanation of what this medicine is and its primary purpose",
  "discoveryAndHistory": "2-3 sentences on when it was discovered/developed, by whom, and its significance",
  "medicalUses": ["5-8 specific conditions or uses this medicine treats"],
  "mechanismOfAction": "1-2 sentences explaining HOW it works in simple terms (e.g. 'blocks the enzyme that...')",
  "commonBrandNames": ["10-15 brand names used worldwide"],
  "keyWarnings": ["3-5 most important warnings a patient should know"],
  "sideEffects": ["5-8 common or important side effects"],
  "interestingFacts": ["3-4 interesting historical or medical facts about this drug"]
}`
  );

  const result: MedicineEncyclopedia = {
    drugName,
    iupacName: pubchem?.iupac,
    molecularFormula: pubchem?.formula,
    ...synthesis,
    isWHOEssential: essential,
    essentialMedicineCategory: category,
    wikipediaUrl: wiki?.content_urls?.desktop?.page,
    pubchemUrl: pubchem?.cid
      ? `https://pubchem.ncbi.nlm.nih.gov/compound/${pubchem.cid}`
      : undefined,
    pubchemCID: pubchem?.cid,
  };

  cache.set(cacheKey, result);
  return result;
}
