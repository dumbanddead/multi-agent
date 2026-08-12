import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'cline-settings.json');

function sanitizeKey(k) {
  // strip accidental "export VAR=", "Bearer ", surrounding quotes/spaces
  return (k || '').trim().replace(/^export\s+\w+=/, '').replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
}

function getSettings() {
  let s = {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    workingDir: '',
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      s = { ...s, ...saved };
    }
  } catch {}
  s.apiKey = sanitizeKey(s.apiKey);
  if (process.env.GEMINI_API_KEY)     { s.apiKey = sanitizeKey(process.env.GEMINI_API_KEY);     s.provider = 'gemini'; }
  if (process.env.GROQ_API_KEY)       { s.apiKey = sanitizeKey(process.env.GROQ_API_KEY);       s.provider = 'groq'; }
  if (process.env.OPENROUTER_API_KEY) { s.apiKey = sanitizeKey(process.env.OPENROUTER_API_KEY); s.provider = 'openrouter'; }
  return s;
}

const PROVIDER_BASE = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq:       'https://api.groq.com/openai/v1',
  gemini:     'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama:     'http://localhost:11434/v1',
};

const AGENT_SYSTEM = `You are an autonomous coding agent. Given a task you:
1. Think through the solution step-by-step (show your reasoning)
2. Write any files using this exact format (no markdown fences around the markers):

[FILE: relative/path/to/file]
<complete file contents here>
[/FILE]

3. Summarise what was done

Keep responses focused. Never truncate file contents. Use the working directory as project root.`;

// Parse [FILE:...] blocks and write them; return cleaned text
function writeFiles(text, workDir) {
  const regex = /\[FILE:\s*([^\]]+)\]\n([\s\S]*?)\n\[\/FILE\]/g;
  let m, written = [];
  while ((m = regex.exec(text)) !== null) {
    const rel = m[1].trim();
    const content = m[2];
    const abs = path.join(workDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    written.push(rel);
  }
  return written;
}

// On Windows .cmd files need cmd.exe /c; on Unix the bare name works
function buildClineCmd(clineArgs) {
  if (process.platform === 'win32') {
    return { exe: 'cmd.exe', args: ['/c', 'cline.cmd', ...clineArgs] };
  }
  return { exe: 'cline', args: clineArgs };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input, mode } = req.body;
  if (!input?.trim()) return res.status(400).json({ error: 'Input is required' });

  const s = getSettings();
  const cwd = s.workingDir || process.cwd();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  // ── AI Task mode: direct LLM API call (no Cline needed) ─────────────────
  if (mode === 'task') {
    if (!s.apiKey) {
      send({ type: 'error', text: 'No API key configured. Click the provider badge in the top bar.' });
      res.end(); return;
    }

    let llmRes, fullText = '';

    // ── Gemini native API (more reliable for free tier than OpenAI compat) ──
    if (s.provider === 'gemini') {
      const model = s.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${s.apiKey}&alt=sse`;
      try {
        llmRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: AGENT_SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
            generationConfig: { temperature: 0.7 },
          }),
        });
      } catch (err) {
        send({ type: 'error', text: `Network error: ${err.message}` }); res.end(); return;
      }
      if (!llmRes.ok) {
        const body = await llmRes.text().catch(() => '');
        send({ type: 'error', text: `Gemini error ${llmRes.status}: ${body.slice(0, 300)}` });
        res.end(); return;
      }
      const reader = llmRes.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      req.on('close', () => reader.cancel());
      while (true) {
        let chunk; try { chunk = await reader.read(); } catch { break; }
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const token = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (token) { fullText += token; send({ type: 'stdout', text: token }); }
          } catch {}
        }
      }

    // ── OpenAI-compat: Groq, OpenRouter, Ollama ──────────────────────────────
    } else {
      const baseUrl = s.baseUrl || PROVIDER_BASE[s.provider] || PROVIDER_BASE.groq;
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      try {
        llmRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${s.apiKey}`,
            'Content-Type': 'application/json',
            ...(s.provider === 'openrouter' ? { 'HTTP-Referer': 'https://ziza.dev', 'X-Title': 'ziza' } : {}),
          },
          body: JSON.stringify({
            model: s.model,
            stream: true,
            messages: [
              { role: 'system', content: AGENT_SYSTEM },
              { role: 'user', content: input.trim() },
            ],
          }),
        });
      } catch (err) {
        send({ type: 'error', text: `Network error: ${err.message}` }); res.end(); return;
      }
      if (!llmRes.ok) {
        const body = await llmRes.text().catch(() => '');
        send({ type: 'error', text: `API error ${llmRes.status}: ${body.slice(0, 300)}` });
        res.end(); return;
      }
      const reader = llmRes.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      req.on('close', () => reader.cancel());
      while (true) {
        let chunk; try { chunk = await reader.read(); } catch { break; }
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content ?? '';
            if (token) { fullText += token; send({ type: 'stdout', text: token }); }
          } catch {}
        }
      }
    }

    // Write any files the agent produced
    try {
      const written = writeFiles(fullText, cwd);
      if (written.length) {
        send({ type: 'stdout', text: `\n\n✅ Files written: ${written.join(', ')}` });
      }
    } catch (err) {
      send({ type: 'stderr', text: `\nFile write error: ${err.message}` });
    }

    send({ type: 'done', code: 0 });
    res.end();
    return;
  }

  // ── Command mode: spawn Cline CLI ────────────────────────────────────────
  const parts = [];
  let cur = '', inQ = false, qChar = '';
  for (const ch of input.trim()) {
    if (inQ) { if (ch === qChar) inQ = false; else cur += ch; }
    else if (ch === '"' || ch === "'") { inQ = true; qChar = ch; }
    else if (ch === ' ') { if (cur) { parts.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) parts.push(cur);

  let exe, args;
  const cmdArgs = parts.slice(1);
  if (!parts[0] || parts[0] === 'cline') {
    ({ exe, args } = buildClineCmd(cmdArgs));
  } else {
    exe = parts[0]; args = cmdArgs;
  }

  const child = spawn(exe, args, { cwd, shell: false, timeout: 180000 });
  child.stdout.on('data', (d) => send({ type: 'stdout', text: d.toString() }));
  child.stderr.on('data', (d) => send({ type: 'stderr', text: d.toString() }));
  child.on('close', (code) => { send({ type: 'done', code }); res.end(); });
  child.on('error', (err) => { send({ type: 'error', text: err.message }); res.end(); });
  req.on('close', () => child.kill());
}
