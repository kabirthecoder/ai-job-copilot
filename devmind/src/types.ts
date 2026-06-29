export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  localPath?: string; // if cloned locally
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  symbolName?: string; // function/class name if extracted via AST
  embedding?: number[];
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export interface PRSummary {
  number: number;
  title: string;
  body: string;
  mergedAt: string | null;
  filesChanged: string[];
}

export interface RepoIndex {
  repoId: string; // owner/repo
  indexedAt: string;
  chunks: CodeChunk[];
  commits: GitCommit[];
  prs: PRSummary[];
  fileTree: string[];
}

export interface AgentContext {
  repo: RepoConfig;
  index: RepoIndex;
  question: string;
}

export interface AgentResult {
  answer: string;
  sources: Array<{ file: string; lines?: string; reason: string }>;
  confidence: 'high' | 'medium' | 'low';
}

export interface OnboardingGuide {
  role: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'data';
  sections: OnboardingSection[];
}

export interface OnboardingSection {
  title: string;
  content: string;
}
