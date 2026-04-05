import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import type { UploadResumeResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  }

  const fileName = file.name;
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "txt" || file.type.startsWith("text/")) {
    const text = await file.text();
    const response: UploadResumeResponse = {
      text,
      source: "txt",
      fileName
    };

    return NextResponse.json(response);
  }

  if (extension === "pdf" || file.type === "application/pdf") {
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractPdfText(buffer);

      const response: UploadResumeResponse = {
        text,
        source: "pdf",
        fileName,
        warning: text
          ? undefined
          : "The PDF uploaded successfully, but very little extractable text was found."
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error("PDF upload parsing failed:", error);

      return NextResponse.json(
        {
          error:
            "We could not extract text from that PDF yet. Try another PDF or paste the resume text manually."
        },
        { status: 400 }
      );
    }
  }

  const response: UploadResumeResponse = {
    text: "",
    source: "unsupported",
    fileName,
    warning:
      "PDF parsing is scaffolded next, but this starter currently auto-ingests plain text files. You can still paste resume text manually below."
  };

  return NextResponse.json(response);
}
