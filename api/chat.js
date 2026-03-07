// api/chat.js  — Vercel Serverless Function
// Uses HuggingFace Inference API with Meta LLaMA

const HF_API_URL =
  "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct";

const SYSTEM_PROMPT = `You're EimemesChat, you're friendly and interactive. You always joke and motivate. You sometime use emoji for more engaging conversation. You always address user as Melhoi.`;

export default async function handler(req, res) {
  // ── CORS headers (allows browser requests) ──────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate HuggingFace token ───────────────────────────────────
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    console.error("HF_TOKEN environment variable is not set");
    return res.status(500).json({ error: "Server misconfiguration: missing API token." });
  }

  // ── Parse request body ───────────────────────────────────────────
  let message, history;
  try {
    ({ message, history } = req.body);
  } catch (e) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' field." });
  }

  // ── Build messages array (system + history + new user message) ───
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Include recent conversation history (last 10 pairs max)
  if (Array.isArray(history)) {
    const recent = history.slice(-20); // last 20 entries (10 pairs)
    for (const msg of recent) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // Append the new user message
  messages.push({ role: "user", content: message });

  // ── Call HuggingFace Inference API ───────────────────────────────
  let hfRes;
  try {
    hfRes = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        stream: false,
      }),
    });
  } catch (networkErr) {
    console.error("Network error calling HuggingFace:", networkErr);
    return res.status(502).json({ error: "Could not reach AI service. Please try again." });
  }

  // ── Handle HuggingFace errors ────────────────────────────────────
  if (hfRes.status === 429) {
    return res.status(429).json({ error: "AI is busy right now. Please wait a moment and try again." });
  }

  if (hfRes.status === 503) {
    return res.status(503).json({ error: "Model is loading. Please wait 20 seconds and try again." });
  }

  if (!hfRes.ok) {
    const errBody = await hfRes.text().catch(() => "");
    console.error(`HuggingFace API error ${hfRes.status}:`, errBody);
    return res.status(502).json({ error: `AI service error (${hfRes.status}). Please try again.` });
  }

  // ── Parse response ───────────────────────────────────────────────
  let hfData;
  try {
    hfData = await hfRes.json();
  } catch (parseErr) {
    console.error("Failed to parse HuggingFace response:", parseErr);
    return res.status(502).json({ error: "Invalid response from AI service." });
  }

  const reply =
    hfData?.choices?.[0]?.message?.content?.trim() ||
    hfData?.generated_text?.trim() ||
    "";

  if (!reply) {
    console.error("Empty reply from HuggingFace:", JSON.stringify(hfData));
    return res.status(502).json({ error: "AI returned an empty response. Please try again." });
  }

  // ── Generate a short title for the first message ─────────────────
  let title = null;
  if (!Array.isArray(history) || history.length === 0) {
    title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
  }

  // ── Return successful response ───────────────────────────────────
  return res.status(200).json({
    reply,
    model: "LLaMA-3-8B",
    ...(title && { title }),
  });
}
