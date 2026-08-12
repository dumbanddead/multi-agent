import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'cline-settings.json');

const DEFAULTS = {
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  baseUrl: 'https://api.groq.com/openai/v1',
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
    // Sanitize key: strip "export VAR=", "Bearer ", quotes
    if (body.apiKey) {
      body.apiKey = body.apiKey.trim().replace(/^export\s+\w+=/, '').replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    }
    const merged = { ...read(), ...body };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    return res.status(200).json({ success: true, settings: merged });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
