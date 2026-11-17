/**
 * Server-side LLM client used by AI features (currently the teacher quiz generator).
 *
 * - Credentials come only from environment variables and never leave the backend.
 * - Supports Anthropic (Claude) and Google Gemini through their REST APIs using the
 *   built-in fetch (Node 18+), so no SDK dependency is added.
 * - Every failure is mapped to an AppError with a teacher-safe message; provider
 *   payloads, keys and stack traces are never returned to the client.
 *
 * Environment:
 *   AI_PROVIDER         anthropic | gemini   (optional; inferred from whichever key is set)
 *   ANTHROPIC_API_KEY   key for Anthropic
 *   GEMINI_API_KEY      key for Google Gemini
 *   AI_MODEL            model id override (defaults below)
 *   AI_TIMEOUT_MS       request timeout, default 60000
 */
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5-5',
  gemini: 'gemini-2.5-flash'
};

export function getAiConfig(env = process.env) {
  const explicit = String(env.AI_PROVIDER || '').trim().toLowerCase();
  let provider = null;
  if (explicit === 'anthropic' || explicit === 'claude') provider = 'anthropic';
  else if (explicit === 'gemini' || explicit === 'google') provider = 'gemini';
  else if (!explicit) provider = env.ANTHROPIC_API_KEY ? 'anthropic' : env.GEMINI_API_KEY ? 'gemini' : null;

  const apiKey = provider === 'anthropic' ? env.ANTHROPIC_API_KEY : provider === 'gemini' ? env.GEMINI_API_KEY : null;
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS) || 60000, 5000), 180000);
  return {
    provider,
    apiKey: apiKey ? String(apiKey).trim() : null,
    model: provider ? String(env.AI_MODEL || DEFAULT_MODELS[provider]).trim() : null,
    timeoutMs,
    configured: Boolean(provider && apiKey && String(apiKey).trim())
  };
}

function unavailable(message, details = null) {
  return new AppError(message, 503, ErrorCodes.AI_UNAVAILABLE, details);
}

async function postJson(url, { headers, body, timeoutMs, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    let json = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, headers: res.headers };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw unavailable('The AI service took too long to respond. Please try again, or create the quiz manually.');
    }
    throw unavailable('Could not reach the AI service. Check the server network connection, or create the quiz manually.');
  } finally {
    clearTimeout(timer);
  }
}

function mapHttpError(provider, status, json, headers) {
  const providerMsg = json?.error?.message || json?.error?.status || '';
  // Log the provider detail server-side only (no key material is ever in these payloads).
  console.warn(`[AI] ${provider} HTTP ${status}: ${String(providerMsg).slice(0, 300)}`);
  if (status === 401 || status === 403) {
    return unavailable('The AI service rejected the server credentials. Ask the administrator to check the AI API key configuration.');
  }
  if (status === 429) {
    const retryAfter = Number(headers?.get?.('retry-after')) || null;
    return new AppError(
      'The AI service is rate limited right now. Please wait a minute and try again.',
      429,
      ErrorCodes.RATE_LIMITED,
      retryAfter ? { retryAfterSeconds: retryAfter } : null
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    return unavailable('The AI service could not process this request (check the configured AI model). You can create the quiz manually.');
  }
  return unavailable('The AI service is temporarily unavailable. Please try again later or create the quiz manually.');
}

async function callAnthropic(cfg, { system, prompt, maxTokens, temperature }, fetchImpl) {
  const { status, json, headers } = await postJson('https://api.anthropic.com/v1/messages', {
    headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    body: {
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: prompt }]
    },
    timeoutMs: cfg.timeoutMs,
    fetchImpl
  });
  if (status < 200 || status >= 300) throw mapHttpError('anthropic', status, json, headers);
  const text = Array.isArray(json?.content)
    ? json.content.filter((b) => b?.type === 'text').map((b) => b.text).join('')
    : '';
  return { text, truncated: json?.stop_reason === 'max_tokens' };
}

async function callGemini(cfg, { system, prompt, maxTokens, temperature }, fetchImpl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const { status, json, headers } = await postJson(url, {
    headers: { 'x-goog-api-key': cfg.apiKey },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: maxTokens }
    },
    timeoutMs: cfg.timeoutMs,
    fetchImpl
  });
  if (status < 200 || status >= 300) throw mapHttpError('gemini', status, json, headers);
  const candidate = json?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p?.text || '').join('');
  return { text, truncated: candidate?.finishReason === 'MAX_TOKENS' };
}

/**
 * Ask the configured model for a JSON document and return the parsed value.
 * Throws AppError(502, AI_INVALID_OUTPUT) when the reply is not parseable JSON.
 */
export async function generateJson(
  { system, prompt, maxTokens = 8000, temperature = 0.4 },
  { config = getAiConfig(), fetchImpl = globalThis.fetch } = {}
) {
  if (!config.configured) {
    throw unavailable('AI quiz generation is not configured on this server. You can still create the quiz manually.', {
      reason: 'NOT_CONFIGURED'
    });
  }
  const call = config.provider === 'anthropic' ? callAnthropic : callGemini;
  const { text, truncated } = await call(config, { system, prompt, maxTokens, temperature }, fetchImpl);
  if (truncated) {
    throw new AppError(
      'The AI response was cut off before it finished. Try fewer questions or shorter syllabus content.',
      502,
      ErrorCodes.AI_INVALID_OUTPUT
    );
  }
  return { data: parseJsonReply(text), provider: config.provider, model: config.model };
}

/** Extract a JSON object from a model reply (tolerates ```json fences). */
export function parseJsonReply(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new AppError('The AI service returned an empty response.', 502, ErrorCodes.AI_INVALID_OUTPUT);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AppError('The AI service returned a response that was not valid quiz data.', 502, ErrorCodes.AI_INVALID_OUTPUT);
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AppError('The AI service returned malformed quiz data.', 502, ErrorCodes.AI_INVALID_OUTPUT);
  }
}
