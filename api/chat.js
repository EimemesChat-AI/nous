// api/chat.js — Fixed HuggingFace integration
// Uses the new HF Inference router with OpenAI-compatible chat format
// Models are free-tier, ungated, and publicly accessible.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    console.error("HF_TOKEN environment variable is missing");
    return res.status(500).json({ error: "Server configuration error: HF_TOKEN not set." });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  // ─── Model priority list ────────────────────────────────────────
  // All of these are free-tier, ungated on HuggingFace Inference API.
  // We try them in order and fall back if one is unavailable.
  const MODELS = [
    "HuggingFaceH4/zephyr-7b-beta",          // Best quality, free & ungated
    "mistralai/Mistral-7B-Instruct-v0.1",     // Older Mistral — less gated
    "google/flan-t5-xxl",                     // Always-on fallback (instruction)
  ];

  const systemPrompt =
    "You are EimemesChat, a friendly and funny AI assistant. " +
    "Always use emojis, crack a joke when you can, and motivate the user. " +
    "Always address the user as Melhoi.";

  // ─── Try each model in sequence ────────────────────────────────
  for (const model of MODELS) {
    // Use the new HF Inference Router with OpenAI-compatible format
    const url = `https://router.huggingface.co/hf-inference/models/${model}/v1/chat/completions`;

    const controller = new AbortController();
    // 30s — HF free tier cold-start can take up to 30s
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`Trying model: ${model}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            // Include up to last 6 history turns for context
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: "user", content: message },
          ],
          max_tokens: 300,
          temperature: 0.75,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // ── Model loading (free tier) — tell the client to retry ──
      if (response.status === 503) {
        const body = await response.json().catch(() => ({}));
        console.warn(`Model ${model} is loading (~${body.estimated_time || 25}s)`);
        // Don't try the next model — loading just means "wait"
        return res.status(503).json({
          error: `The AI model is warming up. Please wait ~${Math.ceil(body.estimated_time || 25)} seconds and try again. ☕`,
        });
      }

      // ── Gated / not found — skip to next model ────────────────
      if (response.status === 403 || response.status === 404) {
        console.warn(`Model ${model} returned ${response.status} — skipping`);
        continue;
      }

      // ── Rate limited ───────────────────────────────────────────
      if (response.status === 429) {
        console.warn(`Rate limited on model ${model} — skipping`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Model ${model} error ${response.status}:`, errorText);
        continue;
      }

      // ── Parse successful response ──────────────────────────────
      const data = await response.json();
      let reply =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";

      reply = reply.trim();
      if (!reply) reply = "Hey Melhoi! 😊 I'm here — ask me anything!";

      // Generate title from first message
      let title = null;
      if (!history || history.length === 0) {
        title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
      }

      console.log(`✅ Response from ${model}`);
      return res.status(200).json({
        reply,
        model: model.split("/")[1] || model,
        ...(title && { title }),
      });

    } catch (err) {
      clearTimeout(timeout);

      if (err.name === "AbortError") {
        console.warn(`Model ${model} timed out after 30s — skipping`);
        continue; // Try next model
      }

      console.error(`Unexpected error with model ${model}:`, err);
      continue;
    }
  }

  // ── All models failed ──────────────────────────────────────────
  console.error("All HuggingFace models failed or were unavailable.");
  return res.status(502).json({
    error:
      "All AI models are currently unavailable. Please check that your HF_TOKEN is valid and try again in a moment. 🙏",
  });
}
