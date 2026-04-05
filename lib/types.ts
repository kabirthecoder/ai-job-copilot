export type AnalysisInput = {
  name?: string;
  targetRole?: string;
  resumeText: string;
  jobDescription: string;
  companyName?: string;
};

export type AnalysisResult = {
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  suggestedProjects: string[];
  interviewQuestions: string[];
  nextSteps: string[];
  atsScore: number;
  recruiterTips: string[];
  coverLetterSnippet: string;
  coldEmailSnippet: string;
  portfolioPitch: string;
  provider?: "ollama" | "openai" | "mock";
  model?: string;
};

export type UploadResumeResponse = {
  text: string;
  source: "txt" | "pdf" | "unsupported";
  fileName: string;
  warning?: string;
};

export type SavedAnalysisSource = "local" | "supabase";

export type SavedAnalysis = {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: SavedAnalysisSource;
  input: AnalysisInput;
  result: AnalysisResult;
};

export type SavedAnalysisDraft = {
  id?: string;
  createdAt?: string;
  source?: SavedAnalysisSource;
  input: AnalysisInput;
  result: AnalysisResult;
};

export type SupabaseEnvConfig = {
  url: string;
  anonKey: string;
  enabled: boolean;
  missing: string[];
};
