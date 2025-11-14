// netlify/functions/grok.mjs
export async function handler(event) {
  // --- CORS ---
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": event.headers["access-control-request-headers"] || "content-type, authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  try {
    // --- Basic Auth (opcional via APP_USER / APP_PASS) ---
    const needAuth = !!(process.env.APP_USER || process.env.APP_PASS);
    if (needAuth) {
      const auth = event.headers.authorization || "";
      const m = auth.match(/^Basic\s+(.+)$/i);
      const decoded = m ? Buffer.from(m[1], "base64").toString("utf8") : "";
      const [u = "", p = ""] = decoded.split(":");
      if (u !== (process.env.APP_USER || "") || p !== (process.env.APP_PASS || "")) {
        // 401 sin WWW-Authenticate para NO disparar el popup del navegador
        return {
          statusCode: 401,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({ ok: false, error: "Unauthorized" })
        };
      }
    }

    // --- Body ---
    const body = JSON.parse(event.body || "{}");
    const prompt = String(body?.prompt || "").slice(0, 8000);
    const lang = (body?.lang || "en").slice(0, 8);
    const context = body?.context ? JSON.stringify(body.context).slice(0, 12000) : "";

    // --- OpenAI ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing OPENAI_API_KEY" })
      };
    }

    const messages = [
      { role: "system", content: `You are a concise market-entry advisor. Prefer bullet points and numbers. Language: ${lang}.` },
      { role: "user", content: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt }
    ];

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages })
    });

    if (!oaiRes.ok) {
      const txt = await oaiRes.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${oaiRes.status} ${txt}`);
    }

    const data = await oaiRes.json();
    const text = data?.choices?.[0]?.message?.content || "No answer";

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, text })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: e.message || String(e) })
    };
  }
}
