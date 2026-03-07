// api/chat.js
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
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Build conversation history
    let prompt = "<|begin_of_text|>system\nYou're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi.<|end_of_text|>\n";
    
    // Add history if available
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user") {
          prompt += `user\n${msg.content}<|end_of_text|>\n`;
        } else if (msg.role === "assistant") {
          prompt += `assistant\n${msg.content}<|end_of_text|>\n`;
        }
      }
    }
    
    // Add current message
    prompt += `user\n${message}<|end_of_text|>\nassistant\n`;

    // Use the NEW router endpoint
    const response = await fetch("https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HuggingFace API error (${response.status}):`, errorText);
      
      if (response.status === 503) {
        return res.status(503).json({ error: "Model is loading. Please wait 20 seconds and try again." });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: "AI is busy. Please wait a moment." });
      }
      
      return res.status(502).json({ error: `AI service error (${response.status})` });
    }

    const data = await response.json();
    
    // Parse response (format varies)
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    if (!reply) {
      console.error("Empty response:", data);
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Extract only the assistant's reply
    const assistantReply = reply.split("assistant\n").pop()?.trim() || reply;

    // Generate title for first message
    let title = null;
    if (!history || history.length === 0) {
      title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    }

    return res.status(200).json({
      reply: assistantReply,
      model: "LLaMA-3-8B",
      ...(title && { title })
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "Internal server error: " + error.message });
  }
    
}
