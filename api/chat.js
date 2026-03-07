// api/chat.js - HUGGINGFACE with correct endpoint
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
    // Build the prompt
    let prompt = "<s>[INST] <<SYS>>\n";
    prompt += "You're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi. Keep responses concise and engaging.\n";
    prompt += "<</SYS>>\n\n";

    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user") {
          prompt += `${msg.content} [/INST] `;
        } else if (msg.role === "assistant") {
          prompt += `${msg.content} </s><s>[INST] `;
        }
      }
    }

    prompt += `${message} [/INST]`;

    console.log("Sending request to HuggingFace Inference API...");

    // ✅ CORRECT ENDPOINT - using the direct inference endpoint
    const response = await fetch(
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
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

    // Handle model loading
    if (response.status === 503) {
      const errorData = await response.json().catch(() => ({}));
      console.log("Model loading:", errorData);
      return res.status(503).json({
        error: "Model is loading. Please wait 20 seconds and try again.",
        estimated_time: errorData.estimated_time || 20
      });
    }

    // Handle rate limits
    if (response.status === 429) {
      return res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    // Handle unauthorized - token might not have access yet
    if (response.status === 403 || response.status === 401) {
      console.error("Authorization error - check token and model access");
      return res.status(502).json({
        error: "HuggingFace authorization failed. Make sure you've accepted the LLaMA license at: https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct"
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HuggingFace API error:", response.status, errorText);
      
      // If we get 404, the endpoint might be wrong or model name incorrect
      if (response.status === 404) {
        return res.status(502).json({
          error: "Model endpoint not found. The model name might have changed or your access is still pending."
        });
      }
      
      return res.status(502).json({
        error: `AI service error (${response.status}). Please try again.`,
      });
    }

    const data = await response.json();
    console.log("HuggingFace response received");

    // Parse response
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Extract only the assistant's reply
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
      model: "LLaMA-3-8B",
      ...(title && { title }),
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({
      error: "Internal server error: " + error.message,
    });
  }
}
