import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const SETTINGS_FILE = path.join(process.cwd(), 'cline-settings.json');

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function buildEnv(s) {
  const env = { ...process.env };
  if (s.apiKey) {
    env.OPENAI_API_KEY = s.apiKey;
    if (s.provider === 'anthropic') env.ANTHROPIC_API_KEY = s.apiKey;
    if (s.provider === 'gemini') env.GEMINI_API_KEY = s.apiKey;
  }
  if (s.baseUrl) env.OPENAI_BASE_URL = s.baseUrl;
  if (s.model) env.OPENAI_MODEL_ID = s.model;
  return env;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command is required' });
  if (!command.trim().toLowerCase().startsWith('cline')) {
    return res.status(400).json({ error: 'Command must start with "cline"' });
  }

  const settings = getSettings();
  const env = buildEnv(settings);
  const cwd = settings.workingDir || process.cwd();

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 10,
      env,
      cwd,
    });
    return res.status(200).json({ success: true, output: stdout, error: stderr || null, command });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      output: error.stdout || '',
      stderr: error.stderr || '',
    });
  }
}
