'use strict';

import { CircuitBreaker } from './circuitBreaker.js';

/**
 * Base Groq API client.
 */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 28000;

export const GroqClient = {
  async call(apiKey, msgs, sys, json = false, maxTok = 700) {
    if (!apiKey) throw new Error('API key not set.');
    if (!navigator.onLine) throw new Error('You are offline. Please reconnect.');
    if (!CircuitBreaker.canCall()) throw new Error('AI temporarily rate-limited.');

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const body = {
      model: MODEL,
      max_tokens: maxTok,
      temperature: 0.35,
      messages: [{ role: 'system', content: sys }, ...msgs]
    };
    if (json) body.response_format = { type: 'json_object' };

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });

      clearTimeout(tid);

      if (res.status === 429) {
        CircuitBreaker.record(false);
        throw new Error('Rate limit exceeded (429). Retrying shortly.');
      }

      if (!res.ok) {
        CircuitBreaker.record(false);
        let d = `HTTP ${res.status}`;
        try { const e = await res.json(); d = e?.error?.message || d; } catch (_) { }
        throw new Error(d);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        CircuitBreaker.record(false);
        throw new Error('Empty response from model.');
      }

      CircuitBreaker.record(true);
      return content;
    } catch (e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') {
        CircuitBreaker.record(false);
        throw new Error('Request timed out (28s).');
      }
      if (!(e.message.includes('429'))) CircuitBreaker.record(false);
      throw e;
    }
  },

  parseJson(raw) {
    try { return JSON.parse(raw); } catch (_) { }
    try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch (_) { }
    try { const m = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/); if (m) return JSON.parse(m[0]); } catch (_) { }
    throw new Error('Could not parse AI response.');
  }
};
