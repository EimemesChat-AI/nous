// api/chat.js - HUGGINGFACE with multiple endpoint attempts
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

    // Try multiple possible HuggingFace endpoints
    const endpoints = [
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://router.huggingface.co/hf-inference/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://router.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://router.huggingface.co/v1/models/meta-llama/Meta-Llama-3-8B-Instruct"
    ];

    let response = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        const fetchResponse = await fetch(endpoint, {
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

        if (fetchResponse.ok) {
          response = fetchResponse;
          console.log(`✅ Success with: ${endpoint}`);
          break;
        } else {
          const errorText = await fetchResponse.text();
          console.log(`❌ ${endpoint} failed: ${fetchResponse.status} - ${errorText}`);
          lastError = { status: fetchResponse.status, text: errorText };
        }
      } catch (e) {
        console.log(`Error with ${endpoint}:`, e.message);
        lastError = e;
      }
    }

    if (!response) {
      console.error("All endpoints failed:", lastError);
      return res.status(502).json({
        error: "AI service temporarily unavailable. Please try again later."
      });
    }

    const data = await response.json();
    console.log("HuggingFace response received");

    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    let assistantReply = reply;
    if (reply.includes("[/INST]")) {
      assistantReply = reply.split("[/INST]").pop()?.trim() || reply;
    }

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
