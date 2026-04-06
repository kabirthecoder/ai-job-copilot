export type CandidateProfile = {
  name?: string;
  email?: string;
  resumeText: string;
};

export type JobTarget = {
  targetRole?: string;
  companyName?: string;
  companyWebsite?: string;
  jobDescription: string;
};

export type AgentContext = {
  candidate: CandidateProfile;
  target: JobTarget;
};

export type RoleForgeAgentName =
  | "resume-agent"
  | "job-agent"
  | "research-agent"
  | "gap-agent"
  | "rewrite-agent"
  | "cover-letter-agent"
  | "review-agent";

export type AgentResult<T> = {
  agent: RoleForgeAgentName;
  mode: "deterministic" | "llm";
  model?: string;
  usedFallback?: boolean;
  output: T;
  notes: string[];
};

export type ResumeAgentOutput = {
  identityHints: string[];
  skills: string[];
  evidenceLines: string[];
};

export type JobAgentOutput = {
  seniority: string;
  roleFamily: string;
  mustHaves: string[];
  niceToHaves: string[];
  languageRequirements: string[];
};

export type ResearchAgentOutput = {
  status: "not_requested" | "researched" | "failed";
  companySummary: string;
  latestSignals: string[];
  sources: string[];
};

export type GapAgentOutput = {
  strengths: string[];
  gaps: string[];
  focusAreas: string[];
};

export type RewriteAgentOutput = {
  rewrittenBullets: string[];
};

export type CoverLetterAgentOutput = {
  coverLetter: string;
};

export type ReviewAgentOutput = {
  approved: boolean;
  issues: string[];
  revisedCoverLetter?: string;
};

export type RoleForgeRun = {
  resume: AgentResult<ResumeAgentOutput>;
  job: AgentResult<JobAgentOutput>;
  research: AgentResult<ResearchAgentOutput>;
  gap: AgentResult<GapAgentOutput>;
  rewrite: AgentResult<RewriteAgentOutput>;
  coverLetter: AgentResult<CoverLetterAgentOutput>;
  review: AgentResult<ReviewAgentOutput>;
};
