import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

const pdfWorkerPath = pathToFileURL(
  path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs")
).href;

PDFParse.setWorker(pdfWorkerPath);

export type IngestionSource =
  | string
  | ArrayBuffer
  | Uint8Array
  | {
      name?: string;
      type?: string;
      text?: string;
      data?: ArrayBuffer | Uint8Array;
    };

export type IngestionKind = "text" | "pdf" | "unknown";

export type IngestionResult = {
  kind: IngestionKind;
  text: string;
  fileName?: string;
  warnings: string[];
};

export async function extractPdfText(source: ArrayBuffer | Uint8Array) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText();
    return normalizeText(result.text);
  } finally {
    await parser.destroy();
  }
}

const PDF_MAGIC = "%PDF-";

export function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

export function isPdfBytes(bytes: Uint8Array) {
  if (bytes.length < PDF_MAGIC.length) {
    return false;
  }

  const header = new TextDecoder("utf-8").decode(bytes.slice(0, PDF_MAGIC.length));
  return header.startsWith(PDF_MAGIC);
}

export function detectIngestionKind(source: IngestionSource): IngestionKind {
  if (typeof source === "string") {
    return source.trim().startsWith(PDF_MAGIC) ? "pdf" : "text";
  }

  if (source instanceof ArrayBuffer) {
    return isPdfBytes(new Uint8Array(source)) ? "pdf" : "text";
  }

  if (source instanceof Uint8Array) {
    return isPdfBytes(source) ? "pdf" : "text";
  }

  if (typeof source.text === "string") {
    return "text";
  }

  if (typeof source.type === "string" && source.type.includes("pdf")) {
    return "pdf";
  }

  if (source.data instanceof ArrayBuffer || source.data instanceof Uint8Array) {
    return isPdfBytes(
      source.data instanceof Uint8Array ? source.data : new Uint8Array(source.data)
    )
      ? "pdf"
      : "text";
  }

  return "unknown";
}

export function ingestTextSource(source: IngestionSource): IngestionResult {
  const kind = detectIngestionKind(source);

  if (typeof source === "string") {
    return {
      kind,
      text: normalizeText(source),
      warnings: kind === "pdf" ? ["PDF detected. Add a parser before production use."] : []
    };
  }

  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    return {
      kind,
      text: normalizeText(text),
      warnings: kind === "pdf" ? ["PDF detected. Add a parser before production use."] : []
    };
  }

  if (typeof source.text === "string") {
    return {
      kind,
      text: normalizeText(source.text),
      fileName: source.name,
      warnings: kind === "pdf" ? ["PDF detected. Add a parser before production use."] : []
    };
  }

  if (source.data instanceof ArrayBuffer || source.data instanceof Uint8Array) {
    const bytes = source.data instanceof Uint8Array ? source.data : new Uint8Array(source.data);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    return {
      kind,
      text: normalizeText(decoded),
      fileName: source.name,
      warnings: kind === "pdf" ? ["PDF detected. Add a parser before production use."] : []
    };
  }

  return {
    kind: "unknown",
    text: "",
    warnings: ["Unsupported source format."]
  };
}

export function buildPdfParserHook(fileName?: string) {
  return {
    fileName,
    supported: false,
    message:
      "PDF parsing is intentionally left as a hook here. Wire in a parser when you are ready to add a dependency."
  };
}
