import NodeCache from "node-cache";
import type { FDADrugRecord, FDARecall } from "../types.js";

// FDA Open API — free, no key required (40 req/min without key)
const FDA_BASE = "https://api.fda.gov/drug";
const cache = new NodeCache({ stdTTL: 3600 }); // cache 1 hour

async function fdaFetch<T>(url: string): Promise<T | null> {
  const cached = cache.get<T>(url);
  if (cached) return cached;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`FDA API error: ${res.status}`);
    const data = (await res.json()) as T;
    cache.set(url, data);
    return data;
  } catch (err) {
    console.warn("FDA API fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

interface FDALabelResponse {
  results?: Array<{
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      manufacturer_name?: string[];
      dosage_form?: string[];
      substance_name?: string[];
    };
  }>;
  error?: { message: string };
}

interface FDAEnforcementResponse {
  results?: Array<{
    recall_initiation_date?: string;
    reason_for_recall?: string;
    product_description?: string;
    recalling_firm?: string;
    status?: string;
  }>;
  error?: { message: string };
}

export async function lookupDrug(drugName: string): Promise<FDADrugRecord> {
  const query = encodeURIComponent(`"${drugName}"`);

  const [labelData, enforcementData] = await Promise.all([
    fdaFetch<FDALabelResponse>(
      `${FDA_BASE}/label.json?search=openfda.brand_name:${query}+openfda.generic_name:${query}&limit=5`
    ),
    fdaFetch<FDAEnforcementResponse>(
      `${FDA_BASE}/enforcement.json?search=product_description:${query}&limit=5`
    ),
  ]);

  // If brand name search returns nothing, try generic name search
  let labelResults = labelData?.results ?? [];
  if (labelResults.length === 0) {
    const genericData = await fdaFetch<FDALabelResponse>(
      `${FDA_BASE}/label.json?search=openfda.generic_name:${query}&limit=5`
    );
    labelResults = genericData?.results ?? [];
  }

  const brandNames = new Set<string>();
  const manufacturers = new Set<string>();
  const dosageForms = new Set<string>();
  const ingredients = new Set<string>();
  let genericName: string | undefined;

  for (const r of labelResults) {
    r.openfda?.brand_name?.forEach((n) => brandNames.add(n));
    r.openfda?.manufacturer_name?.forEach((m) => manufacturers.add(m));
    r.openfda?.dosage_form?.forEach((d) => dosageForms.add(d));
    r.openfda?.substance_name?.forEach((s) => ingredients.add(s));
    if (!genericName && r.openfda?.generic_name?.[0]) {
      genericName = r.openfda.generic_name[0];
    }
  }

  const recalls: FDARecall[] = (enforcementData?.results ?? []).map((r) => ({
    recallDate: r.recall_initiation_date ?? "Unknown",
    reason: r.reason_for_recall ?? "Not specified",
    product: r.product_description ?? drugName,
    company: r.recalling_firm ?? "Unknown",
    status: r.status ?? "Unknown",
  }));

  return {
    found: labelResults.length > 0,
    brandNames: [...brandNames],
    genericName,
    manufacturers: [...manufacturers],
    dosageForms: [...dosageForms],
    activeIngredients: [...ingredients],
    hasRecalls: recalls.length > 0,
    recalls,
  };
}
