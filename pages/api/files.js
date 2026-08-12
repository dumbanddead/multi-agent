import fs from 'fs';
import path from 'path';

function safeBase(req) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'cline-settings.json'), 'utf8'));
    return s.workingDir || process.cwd();
  } catch { return process.cwd(); }
}

function isSafe(base, target) {
  const rel = path.relative(base, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export default function handler(req, res) {
  const base = safeBase(req);

  if (req.method === 'GET') {
    const reqPath = req.query.path ? path.resolve(req.query.path) : base;
    if (!isSafe(base, reqPath) && reqPath !== base) {
      return res.status(403).json({ error: 'Access denied' });
    }
    try {
      const stat = fs.statSync(reqPath);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(reqPath, { withFileTypes: true })
          .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
          .sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map(e => ({ name: e.name, isDir: e.isDirectory(), path: path.join(reqPath, e.name) }));
        return res.json({ type: 'dir', path: reqPath, entries });
      } else {
        const content = fs.readFileSync(reqPath, 'utf8');
        return res.json({ type: 'file', path: reqPath, content });
      }
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const abs = path.resolve(filePath);
    if (!isSafe(base, abs)) return res.status(403).json({ error: 'Access denied' });
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content ?? '', 'utf8');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
