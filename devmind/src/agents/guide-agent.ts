import { chat } from '../llm.js';
import type { AgentContext, OnboardingGuide, RepoIndex } from '../types.js';

export type Role = OnboardingGuide['role'];

export async function guideAgent(
  index: RepoIndex,
  role: Role,
  repoId: string,
): Promise<OnboardingGuide> {
  const fileTree = index.fileTree.slice(0, 300).join('\n');

  // Pull README if present
  const readmeChunk = index.chunks.find(c => /readme/i.test(c.filePath));
  const readme = readmeChunk?.content.slice(0, 2000) ?? '';

  // Grab package/config files for stack detection
  const configChunks = index.chunks
    .filter(c => /package\.json|go\.mod|requirements\.txt|Cargo\.toml|pom\.xml/i.test(c.filePath))
    .slice(0, 3)
    .map(c => `// ${c.filePath}\n${c.content.slice(0, 800)}`)
    .join('\n\n');

  const raw = await chat([
    {
      role: 'system',
      content: `You are DevMind. Generate a practical onboarding guide for a new ${role} engineer joining the ${repoId} project.
Output valid JSON matching this shape:
{
  "role": "${role}",
  "sections": [
    { "title": "string", "content": "string (markdown)" }
  ]
}
Include 6-8 sections: Project Overview, Tech Stack, Repository Structure, Getting Started, Key Files & Modules, Architecture & Data Flow, Common Tasks, Tips & Gotchas.
Be specific to the actual codebase — no generic advice.`,
    },
    {
      role: 'user',
      content: `File tree:\n${fileTree}\n\nREADME:\n${readme}\n\nConfig files:\n${configChunks}`,
    },
  ], { json: true });

  try {
    return JSON.parse(raw) as OnboardingGuide;
  } catch {
    // fallback if JSON parsing fails
    return {
      role,
      sections: [{ title: 'Onboarding Guide', content: raw }],
    };
  }
}
