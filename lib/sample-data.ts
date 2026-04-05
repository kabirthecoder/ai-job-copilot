export type SampleProfile = {
  name: string;
  targetRole: string;
  resumeText: string;
  jobDescription: string;
};

export const sampleProfile: SampleProfile = {
  name: "Kabir",
  targetRole: "AI Engineer",
  resumeText:
    "Built web applications with React, Next.js, Node.js, Python, SQL, Git, and machine learning coursework. Created REST APIs, dashboards, automation tools, and experimented with LLM workflows for product features.",
  jobDescription:
    "We are hiring an AI Engineer with experience in Python, TypeScript, React, LLM applications, RAG pipelines, vector database workflows, prompt engineering, AWS, Docker, and testing. The ideal candidate can build product-facing AI assistants and evaluate model outputs."
};

export const sampleResumeBullets = [
  "Built data-driven web apps with React, Next.js, Node.js, Python, SQL, and Git.",
  "Created REST APIs, dashboards, and automation tools for small product workflows.",
  "Explored LLM product ideas with prompt engineering and retrieval-based patterns."
];

export const sampleProjectIdeas = [
  "Resume-job copilot with fit scoring, gap analysis, and project recommendations.",
  "Interview prep assistant that generates role-specific mock questions and feedback.",
  "Document-aware research helper that summarizes notes and links them to skill gaps."
];

export function getSampleProfile(overrides: Partial<SampleProfile> = {}): SampleProfile {
  return {
    ...sampleProfile,
    ...overrides
  };
}
