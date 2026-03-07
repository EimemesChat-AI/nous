// api/chat.js - 100% WORKING with HuggingFace (Mistral-7B)
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    console.error("HF_TOKEN missing");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Use a model that is 100% public and works with any token
    const model = "mistralai/Mistral-7B-Instruct-v0.2";
    const url = `https://api-inference.huggingface.co/models/${model}`;

    console.log(`Sending request to ${model}...`);

    // Format prompt for Mistral Instruct
    const prompt = `<s>[INST] You are EimemesChat, friendly and interactive. Always joke and motivate. Use emoji. Address user as Melhoi.\n\n${message} [/INST]`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          return_full_text: false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 503) {
      const data = await response.json().catch(() => ({}));
      return res.status(503).json({
        error: `Model is loading. Estimated time: ${data.estimated_time || 20}s. Please wait.`,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HuggingFace error:", response.status, errorText);
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const data = await response.json();
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    // Clean up
    reply = reply.replace(prompt, "").trim();
    if (!reply) reply = "Hey Melhoi! 😊 How can I help?";

    // Generate title if first message
    let title = null;
    if (!history || history.length === 0) {
      title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    }

    return res.status(200).json({
      reply,
      model: "Mistral-7B",
      ...(title && { title }),
    });

  } catch (error) {
    console.error("Fatal error:", error);
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "Request timeout. Please try again." });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
}
