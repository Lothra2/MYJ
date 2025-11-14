// netlify/functions/grok.js
export default async (req) => {
  // CORS
  const cors = {
    "Access-Control-Allow-Origin": "*", // puedes limitarlo a tu dominio si quieres
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ||
      "content-type, authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: cors,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").slice(0, 8000);
    const lang = (body?.lang || "en").slice(0, 8);
    const context = body?.context ? JSON.stringify(body.context).slice(0, 12000) : "";

    // ✅ Basic Auth opcional (usa APP_USER/APP_PASS de tus env vars)
    const needAuth = process.env.APP_USER || process.env.APP_PASS;
    if (needAuth) {
      const auth = req.headers.get("authorization") || "";
      const expected =
        "Basic " +
        Buffer.from(
          `${process.env.APP_USER || ""}:${process.env.APP_PASS || ""}`
        ).toString("base64");
      if (auth !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": 'Basic realm="MYJ"' },
        });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sys = `You are a concise market-entry advisor. Prefer bullet points and numbers.
If context is present (scores, KPIs, weights), use it directly. Language: ${lang}.`;

    const messages = [
      { role: "system", content: sys },
      {
        role: "user",
        content: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt,
      },
    ];

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages,
      }),
    });

    if (!oaiRes.ok) {
      const txt = await oaiRes.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${oaiRes.status} ${txt}`);
    }

    const data = await oaiRes.json();
    const text = data?.choices?.[0]?.message?.content || "No answer";

    return new Response(JSON.stringify({ ok: true, text }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
};
