import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentChunk, TextSource } from "./types.js";

export type VectorRecord = {
  id: string;
  source: TextSource;
  text: string;
  embedding: number[];
  contentHash: string;
  updatedAt: string;
};

type VectorIndex = {
  records: Record<string, VectorRecord>;
};

const VECTOR_DIR = path.resolve(process.cwd(), "data", "vector-store");
const VECTOR_FILE = path.join(VECTOR_DIR, "index.json");

function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

async function ensureVectorDir() {
  await mkdir(VECTOR_DIR, { recursive: true });
}

async function loadVectorIndex(): Promise<VectorIndex> {
  await ensureVectorDir();

  try {
    const raw = await readFile(VECTOR_FILE, "utf8");
    return JSON.parse(raw) as VectorIndex;
  } catch {
    return { records: {} };
  }
}

async function saveVectorIndex(index: VectorIndex) {
  await ensureVectorDir();
  await writeFile(VECTOR_FILE, JSON.stringify(index, null, 2), "utf8");
}

export async function upsertVectorRecords(
  chunks: DocumentChunk[],
  embedMany: (texts: string[]) => Promise<number[][]>
) {
  const index = await loadVectorIndex();
  const missing = chunks.filter((chunk) => {
    const existing = index.records[chunk.id];
    return !existing || existing.contentHash !== hashContent(chunk.text);
  });

  if (missing.length > 0) {
    const embeddings = await embedMany(missing.map((chunk) => chunk.text));

    missing.forEach((chunk, idx) => {
      index.records[chunk.id] = {
        id: chunk.id,
        source: chunk.source,
        text: chunk.text,
        embedding: embeddings[idx],
        contentHash: hashContent(chunk.text),
        updatedAt: new Date().toISOString()
      };
    });

    await saveVectorIndex(index);
  }

  const records = chunks
    .map((chunk) => index.records[chunk.id])
    .filter(Boolean);

  return {
    status: missing.length > 0 ? ("cold" as const) : ("warm" as const),
    records
  };
}
