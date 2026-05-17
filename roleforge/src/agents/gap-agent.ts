import type {
  AgentResult,
  GapAgentOutput,
  JobAgentOutput,
  NlpSignals,
  ResumeAgentOutput
} from "../types.js";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function buildScoringCriteria(job: JobAgentOutput, nlp?: NlpSignals) {
  return unique([
    ...job.mustHaves,
    ...(nlp?.jobSkills ?? []),
    ...job.niceToHaves.slice(0, 4)
  ]);
}

function computeBaselineAtsScore(
  resume: ResumeAgentOutput,
  job: JobAgentOutput,
  nlp?: NlpSignals
) {
  const scoringCriteria = buildScoringCriteria(job, nlp);
  const matchedCriteria = scoringCriteria.filter((skill) => resume.skills.includes(skill));
  const matchedMustHaves = job.mustHaves.filter((skill) => resume.skills.includes(skill));

  const mustHaveCoverage = job.mustHaves.length
    ? matchedMustHaves.length / job.mustHaves.length
    : 0.65;
  const broaderCoverage = scoringCriteria.length
    ? matchedCriteria.length / scoringCriteria.length
    : mustHaveCoverage;

  const weightedScore = (mustHaveCoverage * 0.6) + (broaderCoverage * 0.4);
  const baseline = 28 + Math.round(weightedScore * 62);

  return {
    scoringCriteria,
    matchedCriteria,
    matchedMustHaves,
    baselineAtsScore: clampScore(baseline)
  };
}

export async function runGapAgent(
  resume: ResumeAgentOutput,
  job: JobAgentOutput,
  nlp?: NlpSignals
): Promise<AgentResult<GapAgentOutput>> {
  const {
    scoringCriteria,
    matchedCriteria,
    matchedMustHaves,
    baselineAtsScore
  } = computeBaselineAtsScore(resume, job, nlp);
  const missingMustHaves = job.mustHaves.filter((skill) => !resume.skills.includes(skill));
  const missingCriteria = scoringCriteria.filter((skill) => !resume.skills.includes(skill));
  const output: GapAgentOutput = {
    strengths: matchedCriteria.slice(0, 6),
    gaps: missingCriteria.slice(0, 6),
    focusAreas: missingCriteria.slice(0, 3),
    atsScore: baselineAtsScore,
    targetAtsScore: Math.max(88, Math.min(96, baselineAtsScore + 16)),
    matchedCount: matchedMustHaves.length,
    missingCount: missingCriteria.length,
    evidenceMap: scoringCriteria.slice(0, 10).map((skill) => ({
      skill,
      status: resume.skills.includes(skill) ? "matched" : "missing",
      evidence: resume.evidenceLines.find((line) => line.toLowerCase().includes(skill)) ?? "No direct evidence found."
    })),
    applicationStrategy: [
      "Lead with the skills you already have that match the job most closely.",
      "Address one or two important gaps with an honest learning plan or a relevant project example.",
      "Use resume bullets and cover letter examples that show real product or project impact."
    ],
    highPriorityFixes: missingCriteria.slice(0, 3).map(
      (skill) => `Add credible evidence for ${skill} in the summary or experience bullets.`
    )
  };

  return {
    agent: "gap-agent",
    mode: "deterministic",
    model: "scoring-engine",
    usedFallback: false,
    output,
    notes: ["Gap Agent used deterministic scoring to produce fit, gaps, and improvement priorities."]
  };
}
