const ALLOWED_ORIGINS = new Set([
  "https://diffy1.com",
  "https://www.diffy1.com",
  "https://diffy1-website.pages.dev",
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://diffy1.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function sendPushover(env, { title, message, url, url_title }) {
  const form = new URLSearchParams({
    token: env.PUSHOVER_API_TOKEN,
    user: env.PUSHOVER_USER_KEY,
    title,
    message,
  });
  if (url) form.set("url", url);
  if (url_title) form.set("url_title", url_title);

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      console.log("pushover response not ok", res.status, await res.text());
    }
  } catch (err) {
    console.log("pushover fetch threw", err.message);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // POST /poke -> create a new poke, notify phone
    if (request.method === "POST" && url.pathname === "/poke") {
      const id = crypto.randomUUID();
      const record = { status: "pending", response: null, createdAt: Date.now() };
      await env.POKES.put(id, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 });

      const replyUrl = `https://diffy1.com/reply.html?id=${id}`;
      await sendPushover(env, {
        title: "You got poked!",
        message: "Someone poked you on diffy1.com 👉 Tap to reply.",
        url: replyUrl,
        url_title: "Reply",
      });

      return json({ id }, 200, origin);
    }

    // POST /visit -> notify phone of a site visit (rate-limited per IP)
    if (request.method === "POST" && url.pathname === "/visit") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const rateLimitKey = `visit-rl:${ip}`;
      const alreadyNotified = await env.POKES.get(rateLimitKey);
      if (!alreadyNotified) {
        await env.POKES.put(rateLimitKey, "1", { expirationTtl: 60 * 30 });
        await sendPushover(env, {
          title: "New visitor",
          message: "Someone's on diffy1.com 👀",
        });
      }
      return json({ ok: true }, 200, origin);
    }

    // GET /status/:id -> poll for a reply
    const statusMatch = url.pathname.match(/^\/status\/([a-f0-9-]+)$/);
    if (request.method === "GET" && statusMatch) {
      const id = statusMatch[1];
      const raw = await env.POKES.get(id);
      if (!raw) return json({ error: "not_found" }, 404, origin);
      return json(JSON.parse(raw), 200, origin);
    }

    // POST /reply/:id -> submit a reply
    const replyMatch = url.pathname.match(/^\/reply\/([a-f0-9-]+)$/);
    if (request.method === "POST" && replyMatch) {
      const id = replyMatch[1];
      const raw = await env.POKES.get(id);
      if (!raw) return json({ error: "not_found" }, 404, origin);
      const record = JSON.parse(raw);
      const body = await request.json().catch(() => ({}));
      const response = (body.response || "").toString().slice(0, 500);
      if (!response.trim()) return json({ error: "empty_response" }, 400, origin);
      record.status = "answered";
      record.response = response;
      record.respondedAt = Date.now();
      await env.POKES.put(id, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 });
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "not_found" }, 404, origin);
  },
};
