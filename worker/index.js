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

// ─── Stripe: subscription checkout ─────────────────────────────────────────

const STRIPE_API = 'https://api.stripe.com/v1';

function priceIdForPlan(planId, env) {
  if (planId === 'pro') return env.STRIPE_PRICE_PRO;
  if (planId === 'plus') return env.STRIPE_PRICE_PLUS;
  return null;
}

async function stripeRequest(env, path, params) {
  const body = new URLSearchParams();
  const flatten = (obj, prefix = '') => {
    for (const [key, val] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        flatten(val, k);
      } else if (Array.isArray(val)) {
        val.forEach((item, i) => {
          if (item && typeof item === 'object') flatten(item, `${k}[${i}]`);
          else body.append(`${k}[${i}]`, item);
        });
      } else if (val !== undefined && val !== null) {
        body.append(k, val);
      }
    }
  };
  flatten(params);

  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe request to ${path} failed`);
  return data;
}

// Direct REST calls to Supabase using the service role key, which bypasses
// RLS entirely. Only used server-side here for the webhook handler, which
// has no logged-in user session to authenticate as.
async function supabaseAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase admin request failed: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function createCheckoutSession(request, env) {
  const { restaurantId, planId, successUrl, cancelUrl, customerEmail } = await request.json();

  const priceId = priceIdForPlan(planId, env);
  if (!priceId) {
    return new Response(JSON.stringify({ error: `Unknown plan: ${planId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await stripeRequest(env, 'checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: restaurantId,
    customer_email: customerEmail || undefined,
    metadata: { restaurant_id: restaurantId, plan_id: planId },
    subscription_data: { metadata: { restaurant_id: restaurantId, plan_id: planId } },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createPortalSession(request, env) {
  const { restaurantId, returnUrl } = await request.json();

  const rows = await supabaseAdmin(env, `restaurants?id=eq.${restaurantId}&select=stripe_customer_id`);
  const customerId = rows?.[0]?.stripe_customer_id;
  if (!customerId) {
    return new Response(JSON.stringify({ error: 'No active subscription found for this restaurant.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await stripeRequest(env, 'billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Verifies the Stripe-Signature header using Web Crypto (HMAC-SHA256),
// per Stripe's documented webhook signing scheme. Rejects requests older
// than 5 minutes to guard against replay of a captured payload.
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');

  return expected === signature;
}

async function stripeWebhook(request, env) {
  const rawBody = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(rawBody);

  try {
    switch (event.type) {
      // Payment confirmed — this is the ONLY place a restaurant's tier
      // should actually be upgraded. Never trust the client for this.
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restaurantId = session.metadata?.restaurant_id || session.client_reference_id;
        const planId = session.metadata?.plan_id;
        if (restaurantId && planId) {
          await supabaseAdmin(env, `restaurants?id=eq.${restaurantId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              subscription_plan: planId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscription_status: 'active',
            }),
          });
        }
        break;
      }

      // Subscription renewed, changed, or its status changed (e.g. past_due).
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const restaurantId = sub.metadata?.restaurant_id;
        if (restaurantId) {
          await supabaseAdmin(env, `restaurants?id=eq.${restaurantId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              subscription_status: sub.status,
              subscription_expires_at: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            }),
          });
        }
        break;
      }

      // Subscription canceled or payment ultimately failed — downgrade to free.
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const restaurantId = sub.metadata?.restaurant_id;
        if (restaurantId) {
          await supabaseAdmin(env, `restaurants?id=eq.${restaurantId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              subscription_plan: 'free',
              subscription_status: 'canceled',
            }),
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    // Still return 200 so Stripe doesn't retry indefinitely on our bug;
    // the error is logged for us to investigate.
  }

  return new Response(JSON.stringify({ received: true }), {
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

    if (url.pathname === '/api/stripe/create-checkout-session' && request.method === 'POST') {
      try {
        return await createCheckoutSession(request, env);
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/stripe/create-portal-session' && request.method === 'POST') {
      try {
        return await createPortalSession(request, env);
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      try {
        return await stripeWebhook(request, env);
      } catch (err) {
        console.error('Webhook error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Everything else: serve the built SPA assets.
    return env.ASSETS.fetch(request);
  },
};
