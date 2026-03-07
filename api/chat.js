// api/chat.js — Uses classic api-inference.huggingface.co (most reliable)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: "HF_TOKEN env variable is not set in Vercel." });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const systemPrompt =
    "You are EimemesChat, a friendly and funny AI assistant. " +
    "Always use emojis, crack a joke, and motivate. Address the user as Melhoi.";

  // ── Strategy 1: New per-model chat completions (api-inference) ──
  // Works for popular instruction-tuned models, no router needed.
  const CHAT_MODELS = [
    "HuggingFaceH4/zephyr-7b-beta",
    "mistralai/Mistral-7B-Instruct-v0.1",
    "microsoft/Phi-3-mini-4k-instruct",
  ];

  for (const model of CHAT_MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`;

    try {
      console.log(`[Strategy 1] Trying: ${url}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

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
      const responseText = await response.text();
      console.log(`[${model}] status=${response.status} body=${responseText.slice(0, 300)}`);

      if (response.status === 503) {
        // Model cold-starting — tell the client to wait
        let estimated = 20;
        try { estimated = JSON.parse(responseText).estimated_time || 20; } catch {}
        return res.status(503).json({
          error: `AI is warming up ☕ Please wait ~${Math.ceil(estimated)}s and try again.`,
        });
      }

      if (!response.ok) {
        console.warn(`[${model}] Non-OK, skipping. Status: ${response.status}`);
        continue;
      }

      const data = JSON.parse(responseText);
      const reply = data?.choices?.[0]?.message?.content?.trim()
        || "Hey Melhoi! 😊 Ask me anything!";

      const title = (!history?.length)
        ? message.slice(0, 50) + (message.length > 50 ? "…" : "")
        : null;

      console.log(`✅ [Strategy 1] Success: ${model}`);
      return res.status(200).json({ reply, model: model.split("/")[1], ...(title && { title }) });

    } catch (err) {
      if (err.name === "AbortError") {
        console.warn(`[${model}] Timed out, skipping`);
      } else {
        console.error(`[${model}] Error:`, err.message);
      }
      continue;
    }
  }

  // ── Strategy 2: Classic text-generation (oldest, most compatible) ──
  const CLASSIC_MODELS = [
    { id: "HuggingFaceH4/zephyr-7b-beta",          fmt: "zephyr"  },
    { id: "tiiuae/falcon-7b-instruct",              fmt: "falcon"  },
    { id: "google/flan-t5-large",                   fmt: "plain"   },
  ];

  function buildPrompt(fmt, msg) {
    if (fmt === "zephyr")
      return `<|system|>\n${systemPrompt}</s>\n<|user|>\n${msg}</s>\n<|assistant|>\n`;
    if (fmt === "falcon")
      return `System: ${systemPrompt}\nUser: ${msg}\nAssistant:`;
    return `${systemPrompt}\n\nUser: ${msg}\nAssistant:`;
  }

  for (const { id, fmt } of CLASSIC_MODELS) {
    const url = `https://api-inference.huggingface.co/models/${id}`;
    const prompt = buildPrompt(fmt, message);

    try {
      console.log(`[Strategy 2] Trying: ${url}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 250,
            temperature: 0.75,
            return_full_text: false,
            do_sample: true,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const responseText = await response.text();
      console.log(`[${id}] status=${response.status} body=${responseText.slice(0, 300)}`);

      if (response.status === 503) {
        let estimated = 20;
        try { estimated = JSON.parse(responseText).estimated_time || 20; } catch {}
        return res.status(503).json({
          error: `AI is warming up ☕ Please wait ~${Math.ceil(estimated)}s and try again.`,
        });
      }

      if (!response.ok) {
        console.warn(`[${id}] Non-OK, skipping. Status: ${response.status}`);
        continue;
      }

      const data = JSON.parse(responseText);
      let reply = "";
      if (Array.isArray(data)) reply = data[0]?.generated_text || "";
      else reply = data?.generated_text || "";

      reply = reply.replace(prompt, "").trim();
      if (!reply) reply = "Hey Melhoi! 😊 Ask me anything!";

      const title = (!history?.length)
        ? message.slice(0, 50) + (message.length > 50 ? "…" : "")
        : null;

      console.log(`✅ [Strategy 2] Success: ${id}`);
      return res.status(200).json({ reply, model: id.split("/")[1], ...(title && { title }) });

    } catch (err) {
      if (err.name === "AbortError") {
        console.warn(`[${id}] Timed out, skipping`);
      } else {
        console.error(`[${id}] Error:`, err.message);
      }
      continue;
    }
  }

  // ── All strategies exhausted ────────────────────────────────────
  console.error("❌ All models failed. Check HF_TOKEN permissions in Vercel env vars.");
  return res.status(502).json({
    error:
      "All AI models failed. Please ensure your HF_TOKEN is valid and has 'Make calls to Inference API' permission. 🙏",
  });
}
                                                               
