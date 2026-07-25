// worker/index.js
// Handles /api/* server-side (so OPENAI_API_KEY never reaches the browser),
// and falls through to the static SPA assets for everything else.

// Cloudflare Workers AI model. Llama 3.3 70b is a strong general-purpose
// instruction-following model and supports JSON mode for structured output.
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function invokeLLM(request, env) {
  const { prompt, response_json_schema } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing "prompt"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const input = {
    messages: [{ role: 'user', content: prompt }],
  };

  // If the caller wants structured JSON back, ask the model to guarantee it.
  if (response_json_schema) {
    input.response_format = {
      type: 'json_schema',
      json_schema: response_json_schema,
    };
  }

  let data;
  try {
    data = await env.AI.run(MODEL, input);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Workers AI request failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const content = data.response ?? '';

  // Match base44's old contract: InvokeLLM returned the raw string,
  // or a parsed object when response_json_schema was passed.
  let result = content;
  if (response_json_schema) {
    try {
      result = typeof content === 'string' ? JSON.parse(content) : content;
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
