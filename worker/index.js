// worker/index.js
// Handles /api/* server-side (so OPENAI_API_KEY never reaches the browser),
// and falls through to the static SPA assets for everything else.

// Groq: fast inference, generous free tier. qwen3-32b gives 60 req/min
// (vs 30 for llama-3.3-70b), better headroom for concurrent AI components.
// Note: Groq's docs flag this model as possibly being phased out in favor
// of openai/gpt-oss-120b — watch for that if requests start failing.
const MODEL = 'qwen/qwen3-32b';

async function invokeLLM(request, env) {
  const { prompt, response_json_schema } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing "prompt"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    // qwen3 is a reasoning model; without this it prepends <think>...</think>
    // blocks that would break plain-text and JSON consumers alike.
    reasoning_effort: 'none',
  };

  if (response_json_schema) {
    body.response_format = { type: 'json_object' };
    body.messages[0].content +=
      '\n\nRespond ONLY with valid JSON matching this schema, no other text: ' +
      JSON.stringify(response_json_schema);
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return new Response(JSON.stringify({ error: 'Groq request failed', detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await groqRes.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  let result = content;
  if (response_json_schema) {
    try {
      result = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Model did not return valid JSON', detail: content }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ result }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // TEMPORARY — remove after debugging the key issue.
    if (url.pathname === '/api/ai/debug-key') {
      const key = env.GROQ_API_KEY || '';
      return new Response(JSON.stringify({
        present: !!env.GROQ_API_KEY,
        length: key.length,
        prefix: key.slice(0, 5),
        suffix: key.slice(-4),
        startsWithGsk: key.startsWith('gsk_'),
        hasWhitespace: /\s/.test(key),
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/ai/invoke-llm' && request.method === 'POST') {
      try {
        return await invokeLLM(request, env);
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Everything else: serve the built SPA assets.
    return env.ASSETS.fetch(request);
  },
};
