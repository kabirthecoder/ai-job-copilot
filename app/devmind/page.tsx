'use client';
import { useState, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_DEVMIND_API_URL ?? 'http://localhost:4001';

interface Message {
  role: 'user' | 'ai';
  content: string;
  sources?: Array<{ file: string; lines?: string }>;
  agent?: string;
}

interface Repo {
  id: string;
  indexedAt: string;
  chunks: number;
}

const QUICK_QUESTIONS = [
  'How does this project work?',
  'What is the tech stack?',
  'How does authentication work?',
  'Generate onboarding guide',
];

export default function DevMindPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexUrl, setIndexUrl] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState('');
  const [tab, setTab] = useState<'chat' | 'guide'>('chat');
  const [guide, setGuide] = useState('');
  const [guideRole, setGuideRole] = useState('fullstack');
  const [guideLoading, setGuideLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/repos`)
      .then(r => r.json())
      .then(d => {
        setRepos(d.repos ?? []);
        if (d.repos?.length) setActiveRepo(d.repos[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeRepo) {
      setMessages([{
        role: 'ai',
        content: `I've loaded **${activeRepo}**. Ask me anything about this codebase.`,
      }]);
      setGuide('');
      setTab('chat');
    }
  }, [activeRepo]);

  async function handleIndex() {
    if (!indexUrl.trim()) return;
    setIndexing(true);
    setIndexProgress('Connecting...');
    try {
      const res = await fetch(`${API}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: indexUrl }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let repoId = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const event = JSON.parse(line.slice(5));
          if (event.type === 'progress') setIndexProgress(event.data);
          if (event.type === 'done') repoId = event.data.repoId;
          if (event.type === 'error') throw new Error(event.data);
        }
      }
      const updated = await fetch(`${API}/repos`).then(r => r.json());
      setRepos(updated.repos ?? []);
      setActiveRepo(repoId);
      setIndexUrl('');
    } catch (err) {
      setIndexProgress(`Error: ${err}`);
    } finally {
      setIndexing(false);
      setTimeout(() => setIndexProgress(''), 3000);
    }
  }

  async function handleAsk(question?: string) {
    const q = question ?? input.trim();
    if (!q || !activeRepo || loading) return;

    if (q === 'Generate onboarding guide') {
      setTab('guide');
      handleGuide();
      return;
    }

    setInput('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: activeRepo, question: q }),
      });
      const data = await res.json();
      setMessages(m => [...m, {
        role: 'ai',
        content: data.answer ?? data.error,
        sources: data.sources,
      }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', content: 'Something went wrong. Check that the DevMind server is running.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuide() {
    if (!activeRepo) return;
    setGuideLoading(true);
    setGuide('');
    try {
      const res = await fetch(`${API}/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: activeRepo, role: guideRole }),
      });
      const data = await res.json();
      if (data.guide?.sections) {
        const md = data.guide.sections
          .map((s: { title: string; content: string }) => `## ${s.title}\n\n${s.content}`)
          .join('\n\n');
        setGuide(md);
      }
    } catch {
      setGuide('Error generating guide.');
    } finally {
      setGuideLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#fafafa' }}>
      {/* Sidebar */}
      <div style={{ width: 240, borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e5e5' }}>
          <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            🧠 DevMind
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>AI codebase agent</div>
        </div>

        <div style={{ padding: '12px 12px 8px' }}>
          <input
            value={indexUrl}
            onChange={e => setIndexUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleIndex()}
            placeholder="github.com/owner/repo"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e5e5', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            onClick={handleIndex}
            disabled={indexing || !indexUrl.trim()}
            style={{ marginTop: 6, width: '100%', padding: '6px', fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5', background: indexing ? '#f5f5f5' : '#000', color: indexing ? '#999' : '#fff', cursor: indexing ? 'not-allowed' : 'pointer' }}
          >
            {indexing ? 'Indexing...' : '+ Index repo'}
          </button>
          {indexProgress && <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.4 }}>{indexProgress}</div>}
        </div>

        <div style={{ fontSize: 11, color: '#bbb', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indexed repos</div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {repos.length === 0 && (
            <div style={{ fontSize: 12, color: '#bbb', padding: '8px 12px' }}>No repos yet</div>
          )}
          {repos.map(r => (
            <div
              key={r.id}
              onClick={() => setActiveRepo(r.id)}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: activeRepo === r.id ? '#f0f7ff' : 'transparent',
                color: activeRepo === r.id ? '#1a6fd4' : '#555',
                borderLeft: activeRepo === r.id ? '2px solid #1a6fd4' : '2px solid transparent',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
            {activeRepo ? `📦 ${activeRepo}` : 'Select a repo'}
          </div>
          {activeRepo && (
            <div style={{ display: 'flex', gap: 6 }}>
              {(['chat', 'guide'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '4px 12px', fontSize: 12, borderRadius: 20, border: '1px solid',
                  borderColor: tab === t ? '#1a6fd4' : '#e5e5e5',
                  background: tab === t ? '#f0f7ff' : 'transparent',
                  color: tab === t ? '#1a6fd4' : '#666',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>{t === 'guide' ? 'Onboarding guide' : 'Chat'}</button>
              ))}
            </div>
          )}
        </div>

        {!activeRepo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
            Index a GitHub repo to get started
          </div>
        ) : tab === 'chat' ? (
          <>
            {/* Chat */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    background: m.role === 'ai' ? '#f0f7ff' : '#f5f5f5', color: m.role === 'ai' ? '#1a6fd4' : '#666',
                  }}>
                    {m.role === 'ai' ? '🧠' : '👤'}
                  </div>
                  <div style={{ maxWidth: '80%' }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.7,
                      background: m.role === 'ai' ? '#fff' : '#f0f7ff',
                      border: '1px solid', borderColor: m.role === 'ai' ? '#e5e5e5' : '#c7dff7',
                      color: '#333', whiteSpace: 'pre-wrap',
                    }}>
                      {m.content}
                    </div>
                    {m.sources?.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {m.sources.slice(0, 4).map((s, j) => (
                          <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#f5f5f5', border: '1px solid #e5e5e5', color: '#888', fontFamily: 'monospace' }}>
                            {s.lines ? `${s.file}:${s.lines}` : s.file}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧠</div>
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: '#fff', border: '1px solid #e5e5e5', fontSize: 13, color: '#999' }}>Thinking...</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e5e5', background: '#fff' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => handleAsk(q)} style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 99, border: '1px solid #e5e5e5',
                    background: '#fafafa', color: '#555', cursor: 'pointer',
                  }}>{q}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAsk()}
                  placeholder="Ask anything about this codebase..."
                  style={{ flex: 1, padding: '9px 14px', fontSize: 13, borderRadius: 8, border: '1px solid #e5e5e5', outline: 'none' }}
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={loading || !input.trim()}
                  style={{ padding: '9px 18px', fontSize: 13, borderRadius: 8, border: 'none', background: '#000', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Guide tab */
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
              <select value={guideRole} onChange={e => setGuideRole(e.target.value)} style={{ padding: '7px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #e5e5e5', outline: 'none' }}>
                {['frontend', 'backend', 'fullstack', 'devops', 'data'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button onClick={handleGuide} disabled={guideLoading} style={{ padding: '7px 18px', fontSize: 13, borderRadius: 8, border: 'none', background: '#000', color: '#fff', cursor: guideLoading ? 'not-allowed' : 'pointer' }}>
                {guideLoading ? 'Generating...' : 'Generate guide'}
              </button>
              {guide && (
                <button
                  onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([guide], { type: 'text/markdown' })); a.download = 'ONBOARDING.md'; a.click(); }}
                  style={{ padding: '7px 18px', fontSize: 13, borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff', color: '#333', cursor: 'pointer' }}
                >
                  Download .md
                </button>
              )}
            </div>
            {guide ? (
              <pre style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap', background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e5e5e5' }}>
                {guide}
              </pre>
            ) : (
              <div style={{ color: '#bbb', fontSize: 14 }}>Select a role and click generate.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
