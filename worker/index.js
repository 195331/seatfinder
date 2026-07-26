// worker/index.js
// Handles /api/* server-side (so OPENAI_API_KEY never reaches the browser),
// and falls through to the static SPA assets for everything else.

// Groq: fast inference, generous free tier. gpt-oss-120b is Groq's
// current recommended model (qwen3-32b and llama-3.3-70b were deprecated
// June 2026). Check console.groq.com/docs/deprecations if this breaks again.
const MODEL = 'openai/gpt-oss-120b';

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
    // gpt-oss models support low/medium/high reasoning effort. 'low' keeps
    // latency down for a restaurant app's UI-facing AI features.
    reasoning_effort: 'low',
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
