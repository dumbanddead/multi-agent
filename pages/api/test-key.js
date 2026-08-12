function sanitizeKey(k) {
  return (k || '').trim().replace(/^export\s+\w+=/, '').replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { provider, apiKey, baseUrl } = req.body;
  apiKey = sanitizeKey(apiKey);

  if (!apiKey || apiKey === 'ollama') {
    return res.status(200).json({ ok: true, message: 'No key needed for Ollama' });
  }

  try {
    let r;

    if (provider === 'gemini') {
      // Gemini native: ?key= param, no Bearer
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    } else if (provider === 'groq') {
      r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } else {
      // openrouter + fallback
      r = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }

    if (r.ok) {
      return res.status(200).json({ ok: true, message: `API key is valid ✓ (${provider})` });
    }
    const body = await r.text().catch(() => '');
    return res.status(200).json({ ok: false, message: `Invalid key (HTTP ${r.status}): ${body.slice(0, 160)}` });
  } catch (err) {
    return res.status(200).json({ ok: false, message: `Connection error: ${err.message}` });
  }
}
