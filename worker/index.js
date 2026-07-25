// worker/index.js
// Handles /api/* server-side (so OPENAI_API_KEY never reaches the browser),
// and falls through to the static SPA assets for everything else.

async function invokeLLM(request, env) {
  const { prompt, response_json_schema } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing "prompt"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  };

  // If the caller wants structured JSON back, ask OpenAI to guarantee it.
  if (response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: response_json_schema,
        strict: true,
      },
    };
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return new Response(JSON.stringify({ error: 'OpenAI request failed', detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await openaiRes.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  // Match base44's old contract: InvokeLLM returned the raw string,
  // or a parsed object when response_json_schema was passed.
  const result = response_json_schema ? JSON.parse(content) : content;

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
