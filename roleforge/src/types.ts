export type CandidateProfile = {
  name?: string;
  email?: string;
  resumeText: string;
};

export type AuthIdentity = {
  userId: string;
  email: string;
  name: string;
};

export type JobTarget = {
  targetRole?: string;
  companyName?: string;
  companyWebsite?: string;
  jobDescription: string;
};

export type JobSearchPreferences = {
  city?: string;
  state?: string;
  country?: string;
};

export type TextSource = "resume" | "job" | "company";

export type DocumentChunk = {
  id: string;
  source: TextSource;
  text: string;
};

export type RetrievalHit = {
  id: string;
  source: TextSource;
  text: string;
  score: number;
};

export type RetrievalContext = {
  query: string;
  embeddingProvider: string;
  vectorStoreStatus: "cold" | "warm";
  hits: RetrievalHit[];
};

export type NlpSignals = {
  resumeSkills: string[];
  jobSkills: string[];
  overlapSkills: string[];
  missingSkills: string[];
  detectedLanguages: string[];
  seniorityHint: string;
  roleThemes: string[];
};

export type AgentContext = {
  candidate: CandidateProfile;
  target: JobTarget;
  preferences?: JobSearchPreferences;
  nlp?: NlpSignals;
  retrieval?: RetrievalContext;
  auth?: AuthIdentity;
};

export type JobLead = {
  id: string;
  title: string;
  companyName: string;
  city?: string;
  state?: string;
  country?: string;
  locationLabel: string;
  applyUrl?: string;
  companyWebsite?: string;
  description: string;
  source: "manual";
};

export type JobMatch = {
  id: string;
  job: JobLead;
  score: number;
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  seniorityFit: string;
};

export type RoleForgeAgentName =
  | "resume-agent"
  | "job-agent"
  | "research-agent"
  | "gap-agent"
  | "rewrite-agent"
  | "cover-letter-agent"
  | "cover-letter-humanizer-agent"
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
  candidateHeadline: string;
  identityHints: string[];
  skills: string[];
  evidenceLines: string[];
  likelyProjects: string[];
};

export type JobAgentOutput = {
  seniority: string;
  roleFamily: string;
  mustHaves: string[];
  niceToHaves: string[];
  languageRequirements: string[];
  businessNeeds: string[];
  successSignals: string[];
};

export type ResearchAgentOutput = {
  status: "not_requested" | "researched" | "failed";
  companySummary: string;
  latestSignals: string[];
  sources: string[];
  roleContext: string[];
};

export type GapAgentOutput = {
  strengths: string[];
  gaps: string[];
  focusAreas: string[];
  atsScore: number;
  targetAtsScore: number;
  matchedCount: number;
  missingCount: number;
  evidenceMap: Array<{
    skill: string;
    status: "matched" | "missing";
    evidence: string;
  }>;
  applicationStrategy: string[];
  highPriorityFixes: string[];
};

export type RewriteAgentOutput = {
  rewrittenBullets: string[];
  revisedSummary: string;
  revisedResumeArtifact: string;
  projectedAtsScore: number;
};

export type CoverLetterAgentOutput = {
  coverLetter: string;
  openingHook: string;
  keySellingPoints: string[];
};

export type CoverLetterHumanizerOutput = {
  coverLetter: string;
  toneNotes: string[];
};

export type ReviewAgentOutput = {
  approved: boolean;
  issues: string[];
  revisedCoverLetter?: string;
  finalRecommendation: string;
};

export type AgentTraceEntry = {
  agent: RoleForgeAgentName;
  model?: string;
  usedFallback?: boolean;
  notes: string[];
  output: unknown;
};

export type RoleForgeRunSummary = {
  id: string;
  createdAt: string;
  candidateName: string;
  companyName: string;
  targetRole: string;
  approved: boolean;
};

export type ApplicationPacketStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "opened";

export type ApplicationPacket = {
  id: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
  status: ApplicationPacketStatus;
  candidateName: string;
  candidateEmail?: string;
  job: JobLead;
  matchScore: number;
  atsScore: number;
  projectedAtsScore: number;
  strengths: string[];
  focusAreas: string[];
  coverLetter: string;
  revisedResumeArtifact: string;
  finalRecommendation: string;
  approvedAt?: string;
  openedAt?: string;
};

export type RoleForgeRun = {
  id: string;
  createdAt: string;
  request: {
    userId: string;
    candidateName: string;
    companyName: string;
    targetRole: string;
  };
  nlp: NlpSignals;
  retrieval: RetrievalContext;
  resume: AgentResult<ResumeAgentOutput>;
  job: AgentResult<JobAgentOutput>;
  research: AgentResult<ResearchAgentOutput>;
  gap: AgentResult<GapAgentOutput>;
  rewrite: AgentResult<RewriteAgentOutput>;
  coverLetter: AgentResult<CoverLetterAgentOutput>;
  coverLetterHumanizer: AgentResult<CoverLetterHumanizerOutput>;
  review: AgentResult<ReviewAgentOutput>;
  trace: AgentTraceEntry[];
};
