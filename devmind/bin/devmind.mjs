#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Dynamic imports to keep startup fast
async function getModules() {
  const [{ indexRepo }, { parseGitHubUrl }, { ask }, { guideAgent }, { loadIndex, listIndexed, deleteIndex }] = await Promise.all([
    import('../dist/src/ingestion/indexer.js'),
    import('../dist/src/ingestion/github.js'),
    import('../dist/src/orchestrator.js'),
    import('../dist/src/agents/guide-agent.js'),
    import('../dist/src/store/vector-store.js'),
  ]);
  return { indexRepo, parseGitHubUrl, ask, guideAgent, loadIndex, listIndexed, deleteIndex };
}

program
  .name('devmind')
  .description('AI codebase onboarding agent — ask anything about any GitHub repo')
  .version('0.1.0');

// ── devmind index <repo-url> ──────────────────────────────────────────────────
program
  .command('index <repo>')
  .description('Index a GitHub repository (e.g. https://github.com/vercel/next.js)')
  .option('-f, --force', 'Force re-index even if cached')
  .option('-b, --branch <branch>', 'Branch to index (default: repo default branch)', 'auto')
  .action(async (repo, opts) => {
    const { indexRepo, parseGitHubUrl } = await getModules();
    const spinner = ora('Connecting to GitHub...').start();
    try {
      const { owner, name: repoName } = (() => {
        const p = parseGitHubUrl(repo);
        return { owner: p.owner, name: p.repo };
      })();

      const config = { owner, repo: repoName, branch: opts.branch };
      await indexRepo(config, {
        force: opts.force,
        onProgress: msg => { spinner.text = msg; },
      });

      spinner.succeed(chalk.green(`✓ Indexed ${owner}/${repoName}`));
      console.log(chalk.dim(`\nRun: devmind ask ${repo} "how does authentication work?"`));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ── devmind ask <repo> [question] ────────────────────────────────────────────
program
  .command('ask <repo> [question]')
  .description('Ask a question about an indexed repo')
  .option('-f, --force', 'Re-index before asking')
  .action(async (repo, question, opts) => {
    const { indexRepo, parseGitHubUrl, ask } = await getModules();
    const spinner = ora('Loading index...').start();

    try {
      const { owner, repo: repoName } = parseGitHubUrl(repo);
      const config = { owner, repo: repoName, branch: 'auto' };

      const index = await indexRepo(config, {
        force: opts.force,
        onProgress: msg => { spinner.text = msg; },
      });

      spinner.stop();

      // Interactive mode if no question provided
      if (!question) {
        console.log(chalk.cyan(`\nDevMind — ${owner}/${repoName}`));
        console.log(chalk.dim('Ask anything about this codebase. Type "exit" to quit.\n'));

        while (true) {
          const { q } = await inquirer.prompt([{
            type: 'input',
            name: 'q',
            message: chalk.green('You:'),
          }]);

          if (!q || q.toLowerCase() === 'exit') break;

          const thinkSpinner = ora('Thinking...').start();
          const result = await ask({ repo: config, index, question: q });
          thinkSpinner.stop();

          console.log('\n' + chalk.bold('DevMind:'));
          console.log(result.answer);

          if (result.sources.length) {
            console.log(chalk.dim('\nSources:'));
            result.sources.forEach(s => {
              const loc = s.lines ? `${s.file}:${s.lines}` : s.file;
              console.log(chalk.dim(`  • ${loc}`));
            });
          }
          console.log();
        }
      } else {
        const thinkSpinner = ora('Thinking...').start();
        const result = await ask({ repo: config, index, question });
        thinkSpinner.stop();

        console.log('\n' + chalk.bold('DevMind:'));
        console.log(result.answer);

        if (result.sources.length) {
          console.log(chalk.dim('\nSources:'));
          result.sources.forEach(s => {
            const loc = s.lines ? `${s.file}:${s.lines}` : s.file;
            console.log(chalk.dim(`  • ${loc}`));
          });
        }
      }
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ── devmind guide <repo> ──────────────────────────────────────────────────────
program
  .command('guide <repo>')
  .description('Generate a role-specific onboarding guide')
  .option('-r, --role <role>', 'Role: frontend | backend | fullstack | devops | data', 'fullstack')
  .option('-o, --output <file>', 'Save guide to a markdown file')
  .option('-f, --force', 'Re-index before generating')
  .action(async (repo, opts) => {
    const { indexRepo, parseGitHubUrl, guideAgent } = await getModules();
    const spinner = ora('Loading index...').start();

    try {
      const { owner, repo: repoName } = parseGitHubUrl(repo);
      const config = { owner, repo: repoName, branch: 'auto' };

      const index = await indexRepo(config, {
        force: opts.force,
        onProgress: msg => { spinner.text = msg; },
      });

      spinner.text = `Generating ${opts.role} onboarding guide...`;
      const guide = await guideAgent(index, opts.role, `${owner}/${repoName}`);
      spinner.stop();

      const md = [`# ${owner}/${repoName} — ${opts.role} Onboarding Guide\n`];
      for (const section of guide.sections) {
        md.push(`## ${section.title}\n\n${section.content}\n`);
      }
      const output = md.join('\n');

      if (opts.output) {
        writeFileSync(opts.output, output, 'utf-8');
        console.log(chalk.green(`✓ Guide saved to ${opts.output}`));
      } else {
        console.log(output);
      }
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ── devmind list ──────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List all indexed repositories')
  .action(async () => {
    const { listIndexed, loadIndex } = await getModules();
    const repos = listIndexed();
    if (!repos.length) {
      console.log(chalk.dim('No repositories indexed yet. Run: devmind index <github-url>'));
      return;
    }
    console.log(chalk.bold('\nIndexed repositories:\n'));
    for (const r of repos) {
      const idx = loadIndex(r);
      const date = idx?.indexedAt ? new Date(idx.indexedAt).toLocaleDateString() : '?';
      const chunks = idx?.chunks.length ?? 0;
      console.log(`  ${chalk.cyan(r)} ${chalk.dim(`— ${chunks} chunks, indexed ${date}`)}`);
    }
  });

// ── devmind clear <repo> ──────────────────────────────────────────────────────
program
  .command('clear <repo>')
  .description('Remove a cached index')
  .action(async repo => {
    const { parseGitHubUrl, deleteIndex } = await getModules();
    const { owner, repo: repoName } = parseGitHubUrl(repo);
    deleteIndex(`${owner}/${repoName}`);
    console.log(chalk.green(`✓ Cleared index for ${owner}/${repoName}`));
  });

program.parse();
