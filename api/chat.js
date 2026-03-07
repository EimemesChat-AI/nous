// api/chat.js — Fixed HuggingFace Router integration
// Correct base URL: https://router.huggingface.co/v1/chat/completions

export default async function handler(req, res) {
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

  // ─── THE CORRECT ENDPOINT ─────────────────────────────────────
  // All models go through this single URL — model is specified in the body.
  const HF_URL = "https://router.huggingface.co/v1/chat/completions";

  // Free-tier, ungated models — tried in order as fallbacks
  const MODELS = [
    "meta-llama/Llama-3.1-8B-Instruct",   // Best quality, widely available
    "HuggingFaceH4/zephyr-7b-beta",        // Reliable fallback
    "microsoft/Phi-3-mini-4k-instruct",    // Lightweight fallback
  ];

  const systemPrompt =
    "You are EimemesChat, a friendly and funny AI assistant. " +
    "Always use emojis, crack a joke when you can, and motivate the user. " +
    "Always address the user as Melhoi.";

  for (const model of MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s

    try {
      console.log(`Trying model: ${model}`);

      const response = await fetch(HF_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
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

      if (response.status === 503) {
        const body = await response.json().catch(() => ({}));
        console.warn(`Model loading: ~${body.estimated_time || 25}s`);
        return res.status(503).json({
          error: `The AI is warming up ☕ Please wait ~${Math.ceil(body.estimated_time || 25)} seconds and try again.`,
        });
      }

      // Skip gated / unavailable models
      if (response.status === 403 || response.status === 404 || response.status === 429) {
        const text = await response.text();
        console.warn(`Model ${model} returned ${response.status}: ${text} — skipping`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Model ${model} error ${response.status}:`, errorText);
        continue;
      }

      const data = await response.json();
      let reply = data?.choices?.[0]?.message?.content?.trim() || "";
      if (!reply) reply = "Hey Melhoi! 😊 I'm here — ask me anything!";

      let title = null;
      if (!history || history.length === 0) {
        title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
      }

      console.log(`✅ Success with model: ${model}`);
      return res.status(200).json({
        reply,
        model: model.split("/")[1] || model,
        ...(title && { title }),
      });

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        console.warn(`Model ${model} timed out — skipping`);
        continue;
      }
      console.error(`Error with model ${model}:`, err);
      continue;
    }
  }

  return res.status(502).json({
    error: "All AI models are currently unavailable. Please check your HF_TOKEN and try again. 🙏",
  });
}
