// netlify/functions/grok.js
export default async (req, context) => {
  // CORS
  const cors = {
    "Access-Control-Allow-Origin": "*",               // mismo origen = no hace falta, pero útil
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") || "content-type, authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").slice(0, 8000); // sanea input

    // --- Basic Auth (usa APP_USER / APP_PASS que ya creaste) ---
    const needAuth = (process.env.APP_USER || process.env.APP_PASS);
    if (needAuth) {
      const auth = req.headers.get("authorization") || "";
      const expected = "Basic " + Buffer.from(`${process.env.APP_USER || ""}:${process.env.APP_PASS || ""}`).toString("base64");
      if (auth !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    // --- Llamada a OpenAI (usa tu OPENAI_API_KEY) ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Falta OPENAI_API_KEY");

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "Eres un asesor de market entry conciso y específico." },
          { role: "user", content: prompt }
        ]
      }),
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text().catch(()=>"");
      throw new Error(`OpenAI HTTP ${oaiRes.status} ${errText}`);
    }

    const data = await oaiRes.json();
    const text = data?.choices?.[0]?.message?.content || "Sin respuesta";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
};
