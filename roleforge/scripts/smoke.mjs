import { runRoleForge } from "../dist/orchestrator.js";

const scenarios = [
  {
    candidate: {
      name: "Kabir Mehta",
      email: "kabir@example.com",
      resumeText:
        "Built machine learning and LLM applications with Python, SQL, React, and Next.js. Developed production-ready prototypes and evaluated prompt quality. Created portfolio projects in AI product development and analytics."
    },
    target: {
      targetRole: "Applied AI Engineer",
      companyName: "Trivago",
      companyWebsite: "https://www.trivago.com",
      jobDescription:
        "We are hiring an Applied AI Engineer to build production ML systems, collaborate with product teams, improve experimentation, and communicate insights. Strong Python, SQL, machine learning, and stakeholder communication required. German and English are preferred."
    }
  },
  {
    candidate: {
      name: "Vipul Sharma",
      email: "vipul@example.com",
      resumeText:
        "Experienced data scientist with Python, SQL, forecasting, experimentation, stakeholder communication, and production analytics work. Built recommendation and pricing prototypes for real business use cases."
    },
    target: {
      targetRole: "Senior Data Scientist",
      companyName: "BearingPoint",
      companyWebsite: "https://www.bearingpoint.com",
      jobDescription:
        "Seeking a Senior Data Scientist with Python, SQL, forecasting, machine learning, stakeholder communication, and strong German and English language skills. Experience in process optimization and production analytics is valued."
    }
  }
];

const iterations = 20;
let failures = 0;
let fallbackCount = 0;

for (let index = 0; index < iterations; index += 1) {
  const scenario = scenarios[index % scenarios.length];

  try {
    const run = await runRoleForge(scenario);
    const required =
      typeof run.gap.output.atsScore === "number" &&
      typeof run.rewrite.output.projectedAtsScore === "number" &&
      typeof run.coverLetter.output.coverLetter === "string" &&
      typeof run.rewrite.output.revisedResumeArtifact === "string";

    if (!required) {
      failures += 1;
      console.error(`Iteration ${index + 1}: missing required output fields`);
    }

    fallbackCount += run.trace.filter((entry) => entry.usedFallback).length;
  } catch (error) {
    failures += 1;
    console.error(`Iteration ${index + 1}:`, error instanceof Error ? error.message : error);
  }
}

console.log(
  JSON.stringify(
    {
      iterations,
      failures,
      averageFallbacksPerRun: Number((fallbackCount / iterations).toFixed(2))
    },
    null,
    2
  )
);

if (failures > 0) {
  process.exitCode = 1;
}
