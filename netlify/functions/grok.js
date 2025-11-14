// netlify/functions/grok.js
export default async (req, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*", // al estar en mismo origen, ni se usa; igual lo dejamos
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
    // body: { mode, lang, prompt, context }

    // (Opcional) Basic Auth con variables de entorno APP_USER / APP_PASS
    const auth = req.headers.get("authorization") || "";
    const expected = (() => {
      const u = process.env.APP_USER || "";
      const p = process.env.APP_PASS || "";
      return u || p ? "Basic " + Buffer.from(`${u}:${p}`).toString("base64") : null;
    })();
    if (expected && auth !== expected) {
      return new Response(JSON.stringify({ ok:false, error:"Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // TODO: Aquí pon tu lógica real:
    // - Llamar a tu proveedor de IA
    // - O generar respuesta local
    // Debe devolver 'text' | 'answer' | 'result' (tu front entiende cualquiera)
    const reply = { text: `Recibí: "${body.prompt}". (Demo OK)` };

    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
};
