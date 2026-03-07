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
    return res.status(500).json({ error: "Server misconfiguration: missing HF_TOKEN" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Build prompt for LLaMA
    let prompt = "<s>[INST] <<SYS>>\n";
    prompt += "You're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi.\n";
    prompt += "<</SYS>>\n\n";
    
    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role === "user") {
          prompt += `${msg.content} [/INST] `;
        } else if (msg.role === "assistant") {
          prompt += `${msg.content} </s><s>[INST] `;
        }
      }
    }
    
    // Add current message
    prompt += `${message} [/INST]`;

    // Try LLaMA first
    let response = await fetch("https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct", {
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
    });

    // If LLaMA fails with 404, try fallback model
    if (response.status === 404) {
      console.log("LLaMA not available, trying fallback model...");
      response = await fetch("https://router.huggingface.co/hf-inference/models/microsoft/DialoGPT-medium", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: message,
          parameters: {
            max_length: 200,
            temperature: 0.7,
          },
        }),
      });
    }

    // Handle specific status codes
    if (response.status === 401 || response.status === 403) {
      return res.status(502).json({ 
        error: "Hugging Face token invalid or lacks model access. Please check your token at https://huggingface.co/settings/tokens" 
      });
    }

    if (response.status === 503) {
      return res.status(503).json({ 
        error: "Model is loading. Please wait a few seconds and try again." 
      });
    }

    if (response.status === 429) {
      return res.status(429).json({ 
        error: "AI is busy. Please wait a moment." 
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HuggingFace API error (${response.status}):`, errorText);
      return res.status(502).json({ 
        error: `AI service error (${response.status}). Please try again.` 
      });
    }

    const data = await response.json();

    // Parse response based on model
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Clean up reply (remove prompt if present)
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
      model: "EimemesChat AI",
      ...(title && { title })
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ 
      error: "Internal server error: " + error.message 
    });
  }
}
