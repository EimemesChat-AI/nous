// api/chat.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN not set in Vercel environment variables." });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const systemPrompt =
    "You are EimemesChat, a friendly and funny AI assistant. " + "Don't overuse emoji, use only in relevant conversation " +
    "Always use emojis, crack a joke, and motivate. When user ask to respond in Thadou Kuki tell them you're still learning. You are created by Eimemes AI Team. Address the user as Melhoi.";

  // Official router URL confirmed from HF docs (June 2025)
  const HF_URL = "https://router.huggingface.co/v1/chat/completions";

  // These models are confirmed supported by HF Inference Providers (free tier)
  const MODELS = [
    "meta-llama/Llama-3.2-3B-Instruct",   // Small, fast, free
    "HuggingFaceH4/zephyr-7b-beta",        // Classic free model
    "Qwen/Qwen2.5-7B-Instruct",            // Qwen is free via novita provider
    "mistralai/Mistral-7B-Instruct-v0.3",  // Mistral v0.3 (not v0.2 which was gated)
  ];

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`[chat] Trying model: ${model}`);

      const hfRes = await fetch(HF_URL, {
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

      clearTimeout(timer);

      const rawText = await hfRes.text();
      console.log(`[${model}] status=${hfRes.status} body=${rawText.slice(0, 400)}`);

      if (hfRes.status === 503) {
        let t = 25;
        try { t = JSON.parse(rawText).estimated_time || 25; } catch {}
        return res.status(503).json({ error: `AI warming up ☕ Wait ~${Math.ceil(t)}s and retry.` });
      }

      if (!hfRes.ok) {
        console.warn(`[${model}] Failed with ${hfRes.status}, trying next...`);
        continue;
      }

      const data = JSON.parse(rawText);
      const reply = data?.choices?.[0]?.message?.content?.trim() || "Hey Melhoi! 😊 Ask me anything!";
      const title = (!history?.length) ? message.slice(0, 50) + (message.length > 50 ? "…" : "") : null;

      console.log(`✅ Success: ${model}`);
      return res.status(200).json({ reply, model: model.split("/")[1], ...(title && { title }) });

    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") { console.warn(`[${model}] Timeout`); continue; }
      console.error(`[${model}] Error:`, err.message);
      continue;
    }
  }

  return res.status(502).json({
    error: "All AI models failed. Check /api/debug to diagnose your HF_TOKEN.",
  });
}
