import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationPacket, ApplicationPacketStatus, RoleForgeRun, RoleForgeRunSummary } from "./types.js";

const RUNS_DIR = path.resolve(process.cwd(), "data", "runs");
const PACKETS_DIR = path.resolve(process.cwd(), "data", "packets");

async function ensureRunsDir() {
  await mkdir(RUNS_DIR, { recursive: true });
}

async function ensurePacketsDir() {
  await mkdir(PACKETS_DIR, { recursive: true });
}

function summarizeRun(run: RoleForgeRun): RoleForgeRunSummary {
  const legacyCandidateName =
    run.resume?.output && "identityHints" in run.resume.output
      ? run.resume.output.identityHints[0]
      : "Unknown candidate";
  const legacyCompanyName =
    run.research?.output && "sources" in run.research.output && run.research.output.sources[0]
      ? run.research.output.sources[0]
      : "Unknown company";
  const legacyTargetRole =
    run.job?.output && "roleFamily" in run.job.output
      ? run.job.output.roleFamily
      : "Unknown role";

  return {
    id: run.id,
    createdAt: run.createdAt,
    candidateName: run.request?.candidateName || legacyCandidateName,
    companyName: run.request?.companyName || legacyCompanyName,
    targetRole: run.request?.targetRole || legacyTargetRole,
    approved: run.review.output.approved
  };
}

export async function persistRun(run: RoleForgeRun) {
  await ensureRunsDir();
  const filePath = path.join(RUNS_DIR, `${run.id}.json`);
  await writeFile(filePath, JSON.stringify(run, null, 2), "utf8");
}

export async function loadRun(runId: string, userId?: string) {
  await ensureRunsDir();
  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  const raw = await readFile(filePath, "utf8");
  const run = JSON.parse(raw) as RoleForgeRun;

  if (userId && run.request?.userId !== userId) {
    throw new Error("Run not found");
  }

  return run;
}

export async function listRuns(userId?: string) {
  await ensureRunsDir();
  const files = (await readdir(RUNS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 120);

  const summaries: RoleForgeRunSummary[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(RUNS_DIR, file), "utf8");
    const run = JSON.parse(raw) as RoleForgeRun;
    if (userId && run.request?.userId !== userId) {
      continue;
    }
    if (userId && !run.request?.userId) {
      continue;
    }
    summaries.push(summarizeRun(run));
    if (summaries.length >= 30) {
      break;
    }
  }

  return summaries;
}

export async function persistPacket(packet: ApplicationPacket) {
  await ensurePacketsDir();
  const filePath = path.join(PACKETS_DIR, `${packet.id}.json`);
  await writeFile(filePath, JSON.stringify(packet, null, 2), "utf8");
}

export async function createPacketFromRun(run: RoleForgeRun, overrides?: Partial<ApplicationPacket>) {
  const packet: ApplicationPacket = {
    id: overrides?.id || `packet_${Date.now()}`,
    runId: run.id,
    createdAt: overrides?.createdAt || new Date().toISOString(),
    updatedAt: overrides?.updatedAt || new Date().toISOString(),
    status: overrides?.status || "ready_for_review",
    candidateName: run.request.candidateName,
    candidateEmail: overrides?.candidateEmail,
    job: overrides?.job || {
      id: `job-${run.id}`,
      title: run.request.targetRole,
      companyName: run.request.companyName,
      locationLabel: "Location not specified",
      description: "",
      source: "manual"
    },
    matchScore: overrides?.matchScore ?? run.gap.output.atsScore,
    atsScore: run.gap.output.atsScore,
    projectedAtsScore: run.rewrite.output.projectedAtsScore,
    strengths: run.gap.output.strengths,
    focusAreas: run.gap.output.focusAreas,
    coverLetter: run.coverLetterHumanizer?.output?.coverLetter || run.coverLetter.output.coverLetter,
    revisedResumeArtifact: run.rewrite.output.revisedResumeArtifact,
    finalRecommendation: run.review.output.finalRecommendation,
    approvedAt: overrides?.approvedAt,
    openedAt: overrides?.openedAt
  };

  await persistPacket(packet);
  return packet;
}

export async function loadPacket(packetId: string) {
  await ensurePacketsDir();
  const filePath = path.join(PACKETS_DIR, `${packetId}.json`);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as ApplicationPacket;
}

export async function updatePacketStatus(packetId: string, status: ApplicationPacketStatus) {
  const packet = await loadPacket(packetId);
  const now = new Date().toISOString();
  const nextPacket: ApplicationPacket = {
    ...packet,
    status,
    updatedAt: now,
    approvedAt: status === "approved" ? now : packet.approvedAt,
    openedAt: status === "opened" ? now : packet.openedAt
  };
  await persistPacket(nextPacket);
  return nextPacket;
}

export async function listPackets() {
  await ensurePacketsDir();
  const files = (await readdir(PACKETS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 60);

  const packets: ApplicationPacket[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(PACKETS_DIR, file), "utf8");
    packets.push(JSON.parse(raw) as ApplicationPacket);
  }

  return packets;
}
