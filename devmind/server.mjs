import 'dotenv/config';
import http from 'http';
import { URL } from 'url';

const PORT = process.env.PORT ?? 4001;

async function getModules() {
  const [{ indexRepo }, { parseGitHubUrl }, { ask }, { guideAgent }, { loadIndex, listIndexed }] = await Promise.all([
    import('./dist/src/ingestion/indexer.js'),
    import('./dist/src/ingestion/github.js'),
    import('./dist/src/orchestrator.js'),
    import('./dist/src/agents/guide-agent.js'),
    import('./dist/src/store/vector-store.js'),
  ]);
  return { indexRepo, parseGitHubUrl, ask, guideAgent, loadIndex, listIndexed };
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function cors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end();
}

const modules = await getModules();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') return cors(res);

  // GET /repos — list indexed repos
  if (req.method === 'GET' && url.pathname === '/repos') {
    const repos = modules.listIndexed().map(id => {
      const idx = modules.loadIndex(id);
      return { id, indexedAt: idx?.indexedAt, chunks: idx?.chunks.length ?? 0 };
    });
    return json(res, 200, { repos });
  }

  // POST /index — index a repo (streams progress via SSE)
  if (req.method === 'POST' && url.pathname === '/index') {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', async () => {
      try {
        const { repoUrl, force } = JSON.parse(body);
        const { owner, repo } = modules.parseGitHubUrl(repoUrl);
        const config = { owner, repo, branch: 'auto' };

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });

        const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

        await modules.indexRepo(config, {
          force: !!force,
          onProgress: msg => send('progress', msg),
        });

        send('done', { repoId: `${owner}/${repo}` });
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: String(err) })}\n\n`);
        res.end();
      }
    });
    return;
  }

  // POST /ask — ask a question
  if (req.method === 'POST' && url.pathname === '/ask') {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', async () => {
      try {
        const { repoId, question } = JSON.parse(body);
        const index = modules.loadIndex(repoId);
        if (!index) return json(res, 404, { error: 'Repo not indexed. Index it first.' });

        const [owner, repo] = repoId.split('/');
        const result = await modules.ask({ repo: { owner, repo, branch: 'auto' }, index, question });
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { error: String(err) });
      }
    });
    return;
  }

  // POST /guide — generate onboarding guide
  if (req.method === 'POST' && url.pathname === '/guide') {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', async () => {
      try {
        const { repoId, role } = JSON.parse(body);
        const index = modules.loadIndex(repoId);
        if (!index) return json(res, 404, { error: 'Repo not indexed. Index it first.' });

        const guide = await modules.guideAgent(index, role ?? 'fullstack', repoId);
        return json(res, 200, { guide });
      } catch (err) {
        return json(res, 500, { error: String(err) });
      }
    });
    return;
  }

  // Health check
  if (url.pathname === '/health') return json(res, 200, { ok: true });

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`DevMind API server running on http://localhost:${PORT}`);
});
