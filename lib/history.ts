import type {
  AnalysisInput,
  AnalysisResult,
  SavedAnalysis,
  SavedAnalysisDraft,
  SavedAnalysisSource
} from "@/lib/types";

const STORAGE_KEY = "ai-research-job-copilot:saved-analyses";

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStore(): SavedAnalysis[] {
  if (!isBrowserStorageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedAnalysis[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items: SavedAnalysis[]) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}

function normalizeSource(source: SavedAnalysisSource | undefined): SavedAnalysisSource {
  return source ?? "local";
}

export function getSavedAnalyses(): SavedAnalysis[] {
  return readStore();
}

export function getSavedAnalysis(id: string): SavedAnalysis | null {
  return readStore().find((analysis) => analysis.id === id) ?? null;
}

export function saveAnalysis(
  input: AnalysisInput,
  result: AnalysisResult,
  source: SavedAnalysisSource = "local"
): SavedAnalysis {
  const timestamp = nowIso();
  const entry: SavedAnalysis = {
    id: randomId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    source,
    input,
    result
  };

  writeStore([entry, ...readStore().filter((analysis) => analysis.id !== entry.id)]);
  return entry;
}

export function upsertSavedAnalysis(draft: SavedAnalysisDraft): SavedAnalysis {
  const timestamp = nowIso();
  const entry: SavedAnalysis = {
    id: draft.id ?? randomId(),
    createdAt: draft.createdAt ?? timestamp,
    updatedAt: timestamp,
    source: normalizeSource(draft.source),
    input: draft.input,
    result: draft.result
  };

  writeStore([entry, ...readStore().filter((analysis) => analysis.id !== entry.id)]);
  return entry;
}

export function deleteSavedAnalysis(id: string): void {
  writeStore(readStore().filter((analysis) => analysis.id !== id));
}

export function clearSavedAnalyses(): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function toSavedAnalysisDraft(
  input: AnalysisInput,
  result: AnalysisResult,
  source: SavedAnalysisSource = "local"
): SavedAnalysisDraft {
  return {
    source,
    input,
    result
  };
}
