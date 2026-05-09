import { cosineSimilarity, embedTexts } from "./embeddings.js";
import type { AgentContext, DocumentChunk, RetrievalContext, RetrievalHit, TextSource } from "./types.js";
import { upsertVectorRecords } from "./vector-store.js";

function chunkText(text: string, source: TextSource, prefix: string, maxLength = 420, overlap = 80) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [] as DocumentChunk[];
  }

  const chunks: DocumentChunk[] = [];
  let cursor = 0;
  let part = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + maxLength, normalized.length);
    const slice = normalized.slice(cursor, end).trim();

    if (slice) {
      chunks.push({
        id: `${prefix}-${part}`,
        source,
        text: slice
      });
      part += 1;
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

function buildCorpus(context: AgentContext) {
  const chunks = [
    ...chunkText(context.candidate.resumeText, "resume", "resume"),
    ...chunkText(context.target.jobDescription, "job", "job")
  ];

  if (context.target.companyName || context.target.companyWebsite) {
    chunks.push({
      id: "company-0",
      source: "company",
      text: `Company name: ${context.target.companyName ?? "Unknown"}. Website: ${context.target.companyWebsite ?? "Not provided"}.`
    });
  }

  return chunks;
}

function buildQuery(context: AgentContext) {
  const role = context.target.targetRole ?? "target role";
  const company = context.target.companyName ?? "target company";
  const nlp = context.nlp;
  const skillText = nlp?.jobSkills.slice(0, 8).join(", ") ?? "";
  const themeText = nlp?.roleThemes.slice(0, 6).join(", ") ?? "";

  return [role, company, skillText, themeText].filter(Boolean).join(" | ");
}

export async function buildRetrievalContext(context: AgentContext): Promise<RetrievalContext> {
  const query = buildQuery(context);
  const corpus = buildCorpus(context);
  const queryEmbedding = await embedTexts([query]);
  const indexed = await upsertVectorRecords(corpus, async (texts) => (await embedTexts(texts)).embeddings);
  const queryVector = queryEmbedding.embeddings[0];

  const hits: RetrievalHit[] = indexed.records
    .map((record) => ({
      id: record.id,
      source: record.source,
      text: record.text,
      score: cosineSimilarity(queryVector, record.embedding)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return {
    query,
    embeddingProvider: queryEmbedding.provider,
    vectorStoreStatus: indexed.status,
    hits
  };
}
