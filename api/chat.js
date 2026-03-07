// api/chat.js - HUGGINGFACE version with approved LLaMA access
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN; // Your Hugging Face token
  if (!HF_TOKEN) {
    console.error("HF_TOKEN missing");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Build the prompt in the format expected by LLaMA chat models
    let prompt = "<s>[INST] <<SYS>>\n";
    prompt += "You're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi. Keep responses concise and engaging.\n";
    prompt += "<</SYS>>\n\n";

    // Add conversation history (if any)
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user") {
          prompt += `${msg.content} [/INST] `;
        } else if (msg.role === "assistant") {
          prompt += `${msg.content} </s><s>[INST] `;
        }
      }
    }

    // Add current user message
    prompt += `${message} [/INST]`;

    console.log("Sending request to HuggingFace Inference API...");

    // ✅ Use the router endpoint (new recommended endpoint)
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
          },
        }),
      }
    );

    // Handle model loading (503)
    if (response.status === 503) {
      return res.status(503).json({
        error: "Model is loading. Please wait a few seconds and try again.",
      });
    }

    // Handle rate limits (429)
    if (response.status === 429) {
      return res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error("HuggingFace API error:", response.status, errorText);
      return res.status(502).json({
        error: `AI service error (${response.status}). Please try again.`,
      });
    }

    // Parse response
    const data = await response.json();
    console.log("HuggingFace response received");

    // The free inference API returns an array with generated_text
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Extract only the assistant's reply (remove the prompt)
    let assistantReply = reply;
    if (reply.includes("[/INST]")) {
      assistantReply = reply.split("[/INST]").pop()?.trim() || reply;
    }

    // Generate title for first message
    let title = null;
    if (!history || history.length === 0) {
      title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    }

    return res.status(200).json({
      reply: assistantReply,
      model: "LLaMA-3-8B (HuggingFace)",
      ...(title && { title }),
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({
      error: "Internal server error: " + error.message,
    });
  }
}
