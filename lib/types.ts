export type AnalysisInput = {
  name?: string;
  email?: string;
  targetRole?: string;
  resumeText: string;
  jobDescription: string;
  companyName?: string;
  companyWebsite?: string;
  enableCompanyResearch?: boolean;
};

export type CompanyResearch = {
  status: "not_requested" | "researched" | "partial" | "failed";
  companySummary: string;
  roleSummary: string;
  latestAchievements: string[];
  hiringSignals: string[];
  sourceUrls: string[];
};

export type AgentStep = {
  id: string;
  title: string;
  status: "completed" | "fallback" | "skipped";
  summary: string;
};

export type AgentSystemTrace = {
  mode: "multi-agent";
  agents: string[];
  completedSteps: AgentStep[];
};

export type AnalysisResult = {
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  languageRequirements?: string[];
  rewrittenResumeBullets?: string[];
  suggestedProjects: string[];
  relevantExperience: string[];
  newProjectIdeas: string[];
  interviewQuestions: string[];
  nextSteps: string[];
  atsScore: number;
  recruiterTips: string[];
  coverLetterSnippet: string;
  coldEmailSnippet: string;
  portfolioPitch: string;
  seniority?: string;
  roleFamily?: string;
  domainFocus?: string[];
  mustHaveSkills?: string[];
  niceToHaveSkills?: string[];
  companyResearch?: CompanyResearch;
  agentSystem?: AgentSystemTrace;
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
