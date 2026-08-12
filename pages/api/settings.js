import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'cline-settings.json');

const DEFAULTS = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
  baseUrl: '',
  workingDir: '',
};

function read() {
  let saved = { ...DEFAULTS };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      saved = { ...saved, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
    }
  } catch {}
  // Env var always wins over saved JSON
  if (process.env.GROQ_API_KEY) {
    saved.apiKey = process.env.GROQ_API_KEY;
    saved.provider = 'groq';
    saved.baseUrl = 'https://api.groq.com/openai/v1';
  } else if (process.env.OPENROUTER_API_KEY) {
    saved.apiKey = process.env.OPENROUTER_API_KEY;
    saved.provider = 'openrouter';
    saved.baseUrl = saved.baseUrl || 'https://openrouter.ai/api/v1';
  }
  return saved;
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(read());
  }
  if (req.method === 'POST') {
    const body = req.body;
    if (body.apiKey) {
      body.apiKey = body.apiKey.trim().replace(/^export\s+\w+=/, '').replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    }
    const prev = read();
    const merged = { ...prev, ...body };
    // Store this provider's key in the keys map so per-agent switching works
    if (body.apiKey !== undefined && body.provider) {
      merged.keys = { ...(prev.keys || {}), ...(body.keys || {}), [body.provider]: body.apiKey };
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    return res.status(200).json({ success: true, settings: merged });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
