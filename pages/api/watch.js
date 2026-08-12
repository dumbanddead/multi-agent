import fs from 'fs';
import path from 'path';

function getWorkDir() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'cline-settings.json'), 'utf8'));
    return s.workingDir || '';
  } catch { return ''; }
}

export default function handler(req, res) {
  const workDir = req.query.dir || getWorkDir();
  if (!workDir || !fs.existsSync(workDir)) {
    return res.status(400).json({ error: 'No working directory' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (obj) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
  };

  send({ type: 'connected', dir: workDir });

  // Debounce rapid bursts (e.g. agent writing multiple files)
  let debounce = null;
  const changed = new Set();

  let watcher;
  try {
    watcher = fs.watch(workDir, { recursive: true }, (event, filename) => {
      if (!filename || filename.startsWith('.') || filename.includes('node_modules')) return;
      changed.add(filename);
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        send({ type: 'change', files: [...changed] });
        changed.clear();
      }, 300);
    });
  } catch {
    // fs.watch with recursive may fail on some Windows configs — fall back to polling
    const seen = new Map();
    const poll = () => {
      try {
        const scan = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { scan(full); continue; }
            const mtime = fs.statSync(full).mtimeMs;
            const rel = path.relative(workDir, full);
            if (seen.get(rel) !== mtime) { changed.add(rel); seen.set(rel, mtime); }
          }
        };
        scan(workDir);
        if (changed.size) { send({ type: 'change', files: [...changed] }); changed.clear(); }
      } catch {}
    };
    const interval = setInterval(poll, 1500);
    req.on('close', () => clearInterval(interval));
    return;
  }

  req.on('close', () => { try { watcher.close(); } catch {} clearTimeout(debounce); });
}
