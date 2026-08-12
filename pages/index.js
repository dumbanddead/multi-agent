import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

// ── Logo ─────────────────────────────────────────────────────────────────────
function MixoLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b5fd"/>
          <stop offset="100%" stopColor="#818cf8"/>
        </linearGradient>
      </defs>
      {/* Background pill */}
      <rect width="40" height="40" rx="11" fill="url(#lg1)"/>
      {/* Z shape — top bar, diagonal, bottom bar */}
      <path d="M10 12h20L10 28h20" stroke="url(#lg2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Spark dot */}
      <circle cx="29" cy="13" r="2.5" fill="white" opacity="0.9"/>
    </svg>
  );
}

// ── Provider config ──────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: 'gemini',     name: 'Gemini',     badge: 'FREE',  model: 'gemini-3.5-flash-lite',      baseUrl: '', keyUrl: 'https://aistudio.google.com/apikey',   hint: 'Free via Google AI Studio — no credit card' },
  { id: 'cerebras',   name: 'Cerebras',   badge: 'FREE',  model: 'gpt-oss-120b',               baseUrl: 'https://api.cerebras.ai/v1',                              keyUrl: 'https://cloud.cerebras.ai',             hint: 'Free 1M tokens/day, ultra-fast — no credit card' },
  { id: 'openrouter', name: 'OpenRouter', badge: 'FREE✦', model: 'openrouter/free',            baseUrl: 'https://openrouter.ai/api/v1',                            keyUrl: 'https://openrouter.ai/keys',            hint: 'Free models available — no credit card' },
  { id: 'ollama',     name: 'Ollama',     badge: 'LOCAL', model: 'qwen2.5-coder:7b',           baseUrl: 'http://localhost:11434/v1',                               keyUrl: 'https://ollama.ai',                     hint: 'Runs locally — no key needed', noKey: true },
];

const EXT_LANG = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust', go: 'golang', html: 'html', css: 'css', json: 'json', md: 'markdown', sh: 'sh', yaml: 'yaml', yml: 'yaml', txt: 'text', env: 'text' };

let nextId = 1;
const makeAgent = () => ({ id: nextId++, name: `Agent ${nextId - 1}`, mode: 'task', provider: null, input: '', output: '', streaming: false, error: '', runTrigger: 0 });

// ── File tree ────────────────────────────────────────────────────────────────
function FileNode({ entry, depth, selectedFile, onSelect, onRefresh }) {
  const [open, setOpen] = useState(depth === 0);
  const [children, setChildren] = useState(null);

  const toggle = async () => {
    if (!entry.isDir) { onSelect(entry); return; }
    if (!open && !children) {
      const r = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
      const d = await r.json();
      setChildren(d.entries || []);
    }
    setOpen(o => !o);
  };

  const icon = entry.isDir ? (open ? '📂' : '📁') : fileIcon(entry.name);
  const active = !entry.isDir && selectedFile?.path === entry.path;

  return (
    <div>
      <div onClick={toggle} title={entry.name}
        style={{
          paddingLeft: 8 + depth * 14, paddingTop: 3, paddingBottom: 3, paddingRight: 8,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          background: active ? 'oklch(52% 0.24 264 / 0.15)' : 'transparent',
          borderRadius: 4, fontSize: 12, userSelect: 'none',
          color: active ? 'oklch(45% 0.24 264)' : 'oklch(80% 0.005 264)',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'oklch(25% 0.01 264)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
      </div>
      {entry.isDir && open && children && (
        <div>
          {children.length === 0
            ? <div style={{ paddingLeft: 8 + (depth + 1) * 14, fontSize: 11, color: 'oklch(55% 0 264)', padding: '2px 8px 2px' + (8 + (depth + 1) * 14) + 'px' }}>empty</div>
            : children.map(c => <FileNode key={c.path} entry={c} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} onRefresh={onRefresh} />)}
        </div>
      )}
    </div>
  );
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { js: '🟨', ts: '🔷', jsx: '⚛️', tsx: '⚛️', py: '🐍', rs: '🦀', go: '🐹', html: '🌐', css: '🎨', json: '📋', md: '📝', sh: '⚡', env: '🔑', yaml: '📄', yml: '📄' };
  return map[ext] || '📄';
}

function FileTree({ workingDir, selectedFile, onSelect }) {
  const [root, setRoot] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!workingDir) return;
    try {
      const r = await fetch(`/api/files?path=${encodeURIComponent(workingDir)}`);
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      setRoot(d);
    } catch (e) { setErr(e.message); }
  }, [workingDir]);

  useEffect(() => { load(); }, [load]);

  if (!workingDir) return <div style={{ padding: 12, fontSize: 11, color: 'oklch(55% 0 264)' }}>Set a working directory in Settings</div>;
  if (err) return <div style={{ padding: 12, fontSize: 11, color: 'oklch(60% 0.2 26)' }}>{err}</div>;
  if (!root) return <div style={{ padding: 12, fontSize: 11, color: 'oklch(55% 0 264)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 4px', borderBottom: '1px solid oklch(25% 0.01 264)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'oklch(55% 0 264)', textTransform: 'uppercase' }}>Explorer</span>
        <button onClick={load} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(55% 0 264)', fontSize: 12, padding: '0 4px' }}>↺</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {root.entries?.map(e => (
          <FileNode key={e.path} entry={e} depth={0} selectedFile={selectedFile} onSelect={onSelect} onRefresh={load} />
        ))}
      </div>
    </div>
  );
}

// ── Code editor (Ace) ────────────────────────────────────────────────────────
function CodeEditor({ filePath, content, onChange, onSave }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [aceReady, setAceReady] = useState(false);

  useEffect(() => {
    const check = () => { if (typeof window !== 'undefined' && window.ace) { setAceReady(true); } else { setTimeout(check, 100); } };
    check();
  }, []);

  useEffect(() => {
    if (!aceReady || !containerRef.current) return;
    if (editorRef.current) { editorRef.current.destroy(); editorRef.current = null; }
    const editor = window.ace.edit(containerRef.current);
    editor.setTheme('ace/theme/one_dark');
    editor.setOptions({ fontSize: '13px', showPrintMargin: false, wrap: true, tabSize: 2 });
    const ext = filePath?.split('.').pop()?.toLowerCase();
    const lang = EXT_LANG[ext] || 'text';
    editor.session.setMode(`ace/mode/${lang}`);
    editor.setValue(content ?? '', -1);
    editor.on('change', () => onChange?.(editor.getValue()));
    editor.commands.addCommand({
      name: 'save', bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
      exec: () => onSave?.(),
    });
    editorRef.current = editor;
    return () => { try { editor.destroy(); } catch {} };
  }, [aceReady, filePath]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getValue() !== (content ?? '')) { ed.setValue(content ?? '', -1); }
  }, [content]);

  if (!aceReady) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e2e', color: 'oklch(60% 0 264)', fontSize: 13 }}>
      Loading editor…
    </div>
  );

  return <div ref={containerRef} style={{ flex: 1, width: '100%', height: '100%' }} />;
}

// ── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, onUpdate, onRemove, canRemove, onFileCreated }) {
  const outputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [agent.output]);

  // Run All trigger — fires when parent increments runTrigger
  useEffect(() => {
    if (agent.runTrigger > 0 && agent.input.trim() && !agent.streaming) run();
  }, [agent.runTrigger]);

  const set = (patch) => onUpdate(agent.id, patch);

  const run = async (inputText, runMode) => {
    const modeToUse = runMode ?? agent.mode;
    const inputToUse = inputText ?? agent.input;
    if (!inputToUse?.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const modeIcon = { task: '🤖', kirocrew: '🦾', command: '⌨️' }[modeToUse] ?? '▶';
    const providerLabel = agent.provider ? ` [${agent.provider}]` : '';
    set({ streaming: true, error: '', output: `${modeIcon}${providerLabel} ${inputToUse}\n\n` });
    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputToUse, mode: modeToUse, provider: agent.provider }),
        signal: abortRef.current.signal,
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'stdout' || msg.type === 'stderr') set(s => ({ output: s.output + msg.text }));
            else if (msg.type === 'error') set({ error: msg.text });
          } catch {}
        }
      }
      onFileCreated?.();
    } catch (err) {
      if (err.name !== 'AbortError') set({ error: err.message });
    } finally {
      set({ streaming: false });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'oklch(18% 0.008 264)', borderRadius: 10, padding: 12, border: '1px solid oklch(28% 0.01 264)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <input value={agent.name} onChange={e => set({ name: e.target.value })}
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'oklch(88% 0.01 264)', width: 130 }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {agent.streaming && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite', display: 'inline-block' }} />}
          {canRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(55% 0 264)', fontSize: 14 }}>✕</button>}
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'oklch(13% 0.005 264)', borderRadius: 8, padding: 3, gap: 3 }}>
        {[
          { id: 'task',      label: '✨ AI Task' },
          { id: 'kirocrew',  label: '🦾 KiroCrew' },
          { id: 'command',   label: '⌨️ CMD' },
        ].map(m => (
          <button key={m.id} onClick={() => set({ mode: m.id })}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500,
              background: agent.mode === m.id ? (m.id === 'kirocrew' ? 'oklch(45% 0.14 138)' : 'oklch(52% 0.24 264)') : 'transparent',
              color: agent.mode === m.id ? 'white' : 'oklch(55% 0 264)',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Per-agent provider selector (AI Task mode only) */}
      {agent.mode === 'task' && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[{ id: null, label: 'Global' }, ...PROVIDERS].map(p => {
            const active = agent.provider === p.id;
            return (
              <button key={String(p.id)} onClick={() => set({ provider: p.id })} title={p.hint || 'Use global settings'}
                style={{
                  flex: 1, padding: '3px 0', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                  border: `1px solid ${active ? 'oklch(52% 0.24 264)' : 'oklch(26% 0.01 264)'}`,
                  background: active ? 'oklch(52% 0.24 264 / 0.18)' : 'oklch(13% 0.005 264)',
                  color: active ? 'oklch(78% 0.18 264)' : 'oklch(48% 0 264)',
                }}>
                {p.label || p.name}
              </button>
            );
          })}
        </div>
      )}

      <textarea rows={3} value={agent.input} onChange={e => set({ input: e.target.value })}
        placeholder={agent.mode === 'task' ? 'Describe a coding task…' : 'cline --version'}
        disabled={agent.streaming}
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (agent.input.trim()) run(); } }}
        style={{ resize: 'none', borderRadius: 7, border: '1px solid oklch(30% 0.01 264)', background: 'oklch(14% 0.005 264)', color: 'oklch(88% 0.01 264)', fontSize: 12, padding: '8px 10px', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />

      <button onClick={() => run()} disabled={agent.streaming || !agent.input.trim()}
        style={{
          borderRadius: 7, border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: agent.streaming || !agent.input.trim() ? 'not-allowed' : 'pointer',
          background: agent.streaming || !agent.input.trim() ? 'oklch(25% 0.005 264)' : 'oklch(52% 0.24 264)',
          color: agent.streaming || !agent.input.trim() ? 'oklch(45% 0 264)' : 'white',
        }}>
        {agent.streaming ? 'Running…' : '▶ Run'}
      </button>

      {agent.error && <p style={{ fontSize: 11, color: '#f87171', margin: 0, padding: '4px 8px', background: 'oklch(20% 0.08 26)', borderRadius: 5 }}>{agent.error}</p>}

      <div ref={outputRef} style={{ height: 180, overflowY: 'auto', background: 'oklch(11% 0.003 264)', borderRadius: 7, padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'oklch(82% 0.01 264)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {agent.output || <span style={{ color: 'oklch(40% 0 264)' }}>Output will appear here…</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {['cline --version', 'cline --help'].map(cmd => (
          <button key={cmd} onClick={() => { set({ mode: 'command', input: cmd }); run(cmd, 'command'); }}
            style={{ fontSize: 10, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 5, border: '1px solid oklch(28% 0.01 264)', background: 'none', color: 'oklch(55% 0 264)', cursor: 'pointer' }}>
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, setSettings, onClose }) {
  const [saving, setSaving] = useState(false);
  const [keyTest, setKeyTest] = useState(null);

  const provider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0];

  const select = (p) => setSettings(s => ({ ...s, provider: p.id, model: p.model, baseUrl: p.baseUrl, apiKey: p.noKey ? 'ollama' : (s.keys?.[p.id] || '') }));

  const save = async () => {
    setSaving(true);
    const toSave = { ...settings, keys: { ...(settings.keys || {}), [settings.provider]: settings.apiKey } };
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toSave) });
    setSettings(toSave);
    setSaving(false);
    onClose();
  };

  const testKey = async () => {
    setKeyTest('testing');
    const r = await fetch('/api/test-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: settings.provider, apiKey: settings.apiKey, baseUrl: settings.baseUrl }) });
    const d = await r.json();
    setKeyTest(d);
    setTimeout(() => setKeyTest(null), 6000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'oklch(16% 0.008 264)', border: '1px solid oklch(28% 0.01 264)', borderRadius: 14, padding: 24, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MixoLogo size={22} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'oklch(90% 0.01 264)' }}>mixo settings</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(55% 0 264)', fontSize: 18 }}>✕</button>
        </div>

        {/* Free API banner */}
        <div style={{ background: 'oklch(22% 0.06 138 / 0.3)', border: '1px solid oklch(45% 0.12 138 / 0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          <strong style={{ color: 'oklch(70% 0.12 138)' }}>🎁 100% Free options</strong>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PROVIDERS.filter(p => !p.noKey).map(p => (
              <a key={p.id} href={p.keyUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'oklch(65% 0.12 264)', textDecoration: 'underline', background: 'oklch(22% 0.01 264)', padding: '2px 8px', borderRadius: 4 }}>
                Get {p.name} key ↗
              </a>
            ))}
          </div>
          <p style={{ margin: '6px 0 0', color: 'oklch(60% 0.01 264)' }}>No credit card. Gemini &amp; Cerebras are fastest to set up.</p>
        </div>

        {/* Provider grid */}
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(55% 0 264)', marginBottom: 8 }}>Provider</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => select(p)}
              title={p.hint}
              style={{
                border: `1.5px solid ${settings.provider === p.id ? 'oklch(52% 0.24 264)' : 'oklch(28% 0.01 264)'}`,
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                background: settings.provider === p.id ? 'oklch(52% 0.24 264 / 0.12)' : 'oklch(14% 0.005 264)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(88% 0.01 264)' }}>{p.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: 'oklch(52% 0.24 138 / 0.2)', color: 'oklch(65% 0.14 138)' }}>{p.badge}</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'oklch(55% 0 264)' }}>{p.hint}</p>
            </button>
          ))}
        </div>

        {/* API key */}
        {!provider.noKey && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(55% 0 264)' }}>API Key</p>
              <a href={provider.keyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'oklch(62% 0.2 264)' }}>Get free key ↗</a>
            </div>
            <input type="password" value={settings.apiKey} onChange={e => setSettings(s => ({ ...s, apiKey: e.target.value }))}
              placeholder="Paste your API key here…"
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 7, border: '1px solid oklch(30% 0.01 264)', background: 'oklch(14% 0.005 264)', color: 'oklch(88% 0.01 264)', fontSize: 13, padding: '8px 12px', outline: 'none' }} />
          </div>
        )}

        {/* Model */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(55% 0 264)' }}>Model</p>
          <input value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 7, border: '1px solid oklch(30% 0.01 264)', background: 'oklch(14% 0.005 264)', color: 'oklch(88% 0.01 264)', fontSize: 13, padding: '8px 12px', outline: 'none' }} />
        </div>

        {/* Working dir */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(55% 0 264)' }}>Working Directory</p>
          <input value={settings.workingDir} onChange={e => setSettings(s => ({ ...s, workingDir: e.target.value }))}
            placeholder="C:\Users\you\my-project"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 7, border: '1px solid oklch(30% 0.01 264)', background: 'oklch(14% 0.005 264)', color: 'oklch(88% 0.01 264)', fontSize: 13, padding: '8px 12px', outline: 'none', fontFamily: 'monospace' }} />
        </div>

        {keyTest && keyTest !== 'testing' && (
          <p style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, marginBottom: 12, background: keyTest.ok ? 'oklch(22% 0.06 138 / 0.3)' : 'oklch(20% 0.08 26 / 0.3)', color: keyTest.ok ? 'oklch(70% 0.14 138)' : '#f87171' }}>
            {keyTest.message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={testKey} disabled={keyTest === 'testing'}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid oklch(35% 0.01 264)', background: 'none', color: 'oklch(70% 0.01 264)', cursor: 'pointer', fontSize: 13 }}>
            {keyTest === 'testing' ? 'Testing…' : '🔑 Test Key'}
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'oklch(52% 0.24 264)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main IDE ─────────────────────────────────────────────────────────────────
export default function MixoIDE() {
  const [settings, setSettings] = useState({ provider: 'gemini', apiKey: '', model: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', workingDir: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agents, setAgents] = useState([makeAgent()]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [fileTreeKey, setFileTreeKey] = useState(0);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [kiroInstalled, setKiroInstalled] = useState(null); // null=unknown, true, false
  const [kiroPanel, setKiroPanel] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (!s.apiKey) setSettingsOpen(true);
    }).catch(() => {});
  }, []);

  // File watcher — auto-refresh tree when any process writes files
  useEffect(() => {
    if (!settings.workingDir) return;
    let es;
    try {
      es = new EventSource(`/api/watch?dir=${encodeURIComponent(settings.workingDir)}`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'change') setFileTreeKey(k => k + 1);
        } catch {}
      };
    } catch {}
    return () => { try { es?.close(); } catch {} };
  }, [settings.workingDir]);

  // Check if kirocrew is installed
  useEffect(() => {
    fetch('/api/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: 'kirocrew --version', mode: 'command' }) })
      .then(r => { setKiroInstalled(r.ok); })
      .catch(() => setKiroInstalled(false));
  }, []);

  const openFile = async (entry) => {
    try {
      const r = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
      const d = await r.json();
      setSelectedFile(entry);
      setEditorContent(d.content ?? '');
      setSaveStatus('idle');
    } catch {}
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaveStatus('saving');
    await fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: selectedFile.path, content: editorContent }) });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateAgent = useCallback((id, patch) => {
    setAgents(prev => prev.map(a => a.id !== id ? a : (typeof patch === 'function' ? { ...a, ...patch(a) } : { ...a, ...patch })));
  }, []);

  const provider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0];
  const configured = !!settings.apiKey;
  const runningCount = agents.filter(a => a.streaming).length;

  return (
    <>
      <Head>
        <title>mixo — Free AI Coding Environment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'oklch(10% 0.005 264)', color: 'oklch(88% 0.01 264)', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 44, borderBottom: '1px solid oklch(22% 0.008 264)', background: 'oklch(12% 0.006 264)', flexShrink: 0 }}>
          <MixoLogo size={28} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>mixo</span>
          <span style={{ fontSize: 11, color: 'oklch(38% 0 264)', borderLeft: '1px solid oklch(25% 0 264)', paddingLeft: 10 }}>free AI IDE</span>

          {/* KiroCrew status chip */}
          <button onClick={() => setKiroPanel(o => !o)}
            title="KiroCrew — persistent agent runtime"
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: kiroInstalled ? 'oklch(22% 0.06 138 / 0.3)' : 'oklch(18% 0.005 264)', border: `1px solid ${kiroInstalled ? 'oklch(45% 0.12 138 / 0.5)' : 'oklch(28% 0.01 264)'}`, borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
            <span style={{ fontSize: 13 }}>🦾</span>
            <span style={{ color: kiroInstalled ? 'oklch(70% 0.12 138)' : 'oklch(50% 0 264)' }}>
              KiroCrew {kiroInstalled ? '● on' : kiroInstalled === false ? '○ off' : '…'}
            </span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Panel toggles */}
          <button onClick={() => setLeftOpen(o => !o)} title="Toggle file tree"
            style={{ background: leftOpen ? 'oklch(25% 0.01 264)' : 'none', border: '1px solid oklch(28% 0.01 264)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'oklch(65% 0 264)' }}>
            📁 Files
          </button>
          <button onClick={() => setRightOpen(o => !o)} title="Toggle agents"
            style={{ background: rightOpen ? 'oklch(25% 0.01 264)' : 'none', border: '1px solid oklch(28% 0.01 264)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'oklch(65% 0 264)' }}>
            {runningCount > 0 ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginRight: 5 }} />{runningCount} running</> : '🤖 Agents'}
          </button>

          {/* Provider badge + settings */}
          <button onClick={() => setSettingsOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(18% 0.008 264)', border: `1px solid ${configured ? 'oklch(45% 0.12 138 / 0.5)' : 'oklch(50% 0.15 40 / 0.5)'}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: configured ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
            <span style={{ color: 'oklch(75% 0.01 264)' }}>{provider.name}</span>
            <span style={{ color: 'oklch(45% 0 264)' }}>⚙</span>
          </button>
        </div>

        {/* Main area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: file tree */}
          {leftOpen && (
            <div style={{ width: 220, borderRight: '1px solid oklch(20% 0.008 264)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <FileTree workingDir={settings.workingDir} selectedFile={selectedFile} onSelect={openFile} key={fileTreeKey} />
            </div>
          )}

          {/* Center: editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Editor tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 34, borderBottom: '1px solid oklch(20% 0.008 264)', background: 'oklch(12% 0.006 264)', flexShrink: 0, overflowX: 'auto' }}>
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', height: '100%', background: 'oklch(16% 0.008 264)', borderRight: '1px solid oklch(22% 0.008 264)', fontSize: 12, color: 'oklch(80% 0.01 264)', whiteSpace: 'nowrap' }}>
                  <span>{fileIcon(selectedFile.name)}</span>
                  <span>{selectedFile.name}</span>
                  <button onClick={saveFile} title="Save (Ctrl+S)"
                    style={{ background: saveStatus === 'saved' ? 'oklch(45% 0.14 138 / 0.2)' : 'none', border: 'none', cursor: 'pointer', color: saveStatus === 'saved' ? '#86efac' : 'oklch(50% 0 264)', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>
                    {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓ saved' : 'save'}
                  </button>
                </div>
              ) : (
                <span style={{ padding: '0 14px', fontSize: 11, color: 'oklch(40% 0 264)' }}>No file open — click a file in the tree</span>
              )}
            </div>

            {selectedFile ? (
              <CodeEditor filePath={selectedFile.path} content={editorContent} onChange={setEditorContent} onSave={saveFile} />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'oklch(35% 0 264)' }}>
                <MixoLogo size={56} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>mixo</p>
                <p style={{ margin: 0, fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
                  {!configured
                    ? <><button onClick={() => setSettingsOpen(true)} style={{ background: 'oklch(52% 0.24 264)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Configure a free API key</button><br /><br />Get one free from Gemini, Groq, or OpenRouter — no credit card</>
                    : 'Open a file from the tree · use an AI agent to create files · Ctrl+S to save'}
                </p>
              </div>
            )}
          </div>

          {/* Right: agents */}
          {rightOpen && (
            <div style={{ width: 340, borderLeft: '1px solid oklch(20% 0.008 264)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid oklch(20% 0.008 264)', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(55% 0 264)' }}>AI Agents</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setAgents(prev => prev.map(a => ({ ...a, runTrigger: (a.runTrigger || 0) + 1 })))}
                    title="Run all agents in parallel"
                    style={{ fontSize: 11, background: 'oklch(45% 0.14 138 / 0.2)', border: '1px solid oklch(45% 0.14 138 / 0.4)', color: 'oklch(65% 0.14 138)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                    ▶▶ Run All
                  </button>
                  <button onClick={() => setAgents(prev => [...prev, makeAgent()])}
                    style={{ fontSize: 11, background: 'oklch(52% 0.24 264 / 0.15)', border: '1px solid oklch(52% 0.24 264 / 0.3)', color: 'oklch(65% 0.2 264)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>
                    + Add Agent
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {agents.map(a => (
                  <AgentCard key={a.id} agent={a} onUpdate={updateAgent}
                    onRemove={() => setAgents(prev => prev.filter(x => x.id !== a.id))}
                    canRemove={agents.length > 1}
                    onFileCreated={() => setFileTreeKey(k => k + 1)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div style={{ height: 22, borderTop: '1px solid oklch(18% 0.006 264)', background: 'oklch(52% 0.24 264)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 12px', fontSize: 11, color: 'white', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>mixo</span>
          <span>·</span>
          <span>{provider.name} — {settings.model || '—'}</span>
          {settings.workingDir && <><span>·</span><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{settings.workingDir}</span></>}
          <div style={{ flex: 1 }} />
          {runningCount > 0 && <span>🤖 {runningCount} agent{runningCount > 1 ? 's' : ''} running</span>}
          {selectedFile && <span>{selectedFile.name}</span>}
        </div>
      </div>

      {settingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)} />}

      {kiroPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'oklch(14% 0.007 264)', border: '1px solid oklch(28% 0.01 264)', borderRadius: 14, padding: 24, width: 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'oklch(90% 0.01 264)' }}>🦾 KiroCrew — Persistent Agents</h2>
              <button onClick={() => setKiroPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(55% 0 264)', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: 'oklch(65% 0.01 264)', lineHeight: 1.7, marginBottom: 16 }}>
              KiroCrew runs your agents as <strong style={{ color: 'oklch(80% 0.01 264)' }}>persistent sessions</strong> with memory, checkpointing, and cron scheduling — agents survive restarts and learn from past tasks.
            </div>

            {kiroInstalled ? (
              <div style={{ background: 'oklch(22% 0.06 138 / 0.25)', border: '1px solid oklch(45% 0.12 138 / 0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'oklch(70% 0.12 138)', marginBottom: 16 }}>
                ✓ KiroCrew is installed — use the <strong>🦾 KiroCrew</strong> mode in any agent card to run persistent tasks.
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: 'oklch(20% 0.06 40 / 0.25)', border: '1px solid oklch(50% 0.15 40 / 0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'oklch(70% 0.1 40)', marginBottom: 12 }}>
                  ○ KiroCrew not detected. Install it to unlock persistent agents.
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'oklch(55% 0 264)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Install (macOS / Linux)</p>
                <pre style={{ background: 'oklch(11% 0.003 264)', border: '1px solid oklch(25% 0.01 264)', borderRadius: 7, padding: '8px 12px', fontSize: 11, color: '#86efac', margin: '0 0 10px', overflowX: 'auto' }}>
                  {'curl -fsSL https://download.crew.kiro.dev/cli.sh | sh'}
                </pre>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'oklch(55% 0 264)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Install (Windows — Python required)</p>
                <pre style={{ background: 'oklch(11% 0.003 264)', border: '1px solid oklch(25% 0.01 264)', borderRadius: 7, padding: '8px 12px', fontSize: 11, color: '#86efac', margin: 0, overflowX: 'auto' }}>
                  {'pip install kirocrew\nkirocrew setup\nkirocrew gateway start'}
                </pre>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'oklch(45% 0 264)', lineHeight: 1.6 }}>
              <strong style={{ color: 'oklch(60% 0 264)' }}>What you get:</strong><br />
              • Agents remember past sessions &amp; self-improve<br />
              • Long tasks survive browser refresh / restarts<br />
              • Schedule agents with cron<br />
              • mixo file tree auto-refreshes as KiroCrew writes files
            </div>

            <a href="https://github.com/kirodotdev/KiroCrew" target="_blank" rel="noreferrer"
              style={{ display: 'block', marginTop: 14, fontSize: 11, color: 'oklch(62% 0.2 264)', textAlign: 'center' }}>
              View KiroCrew on GitHub ↗
            </a>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: oklch(14% 0.005 264); }
        ::-webkit-scrollbar-thumb { background: oklch(30% 0.01 264); border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </>
  );
}
