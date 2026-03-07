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
    // Try multiple possible endpoints
    const endpoints = [
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://api-inference.huggingface.co/models/meta-llama/Llama-3-8b-chat-hf",
      "https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct"
    ];

    let lastError = null;
    let response = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        // Simple prompt format for testing
        const prompt = `<s>[INST] <<SYS>>
You are EimemesChat, a friendly and helpful AI assistant. You always address the user as Melhoi and use emojis occasionally.
<</SYS>>

${message} [/INST]`;

        response = await fetch(endpoint, {
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

        if (response.ok) {
          console.log(`Success with endpoint: ${endpoint}`);
          break;
        } else {
          const errorText = await response.text();
          console.log(`Endpoint ${endpoint} failed:`, response.status, errorText);
          lastError = { status: response.status, text: errorText };
          response = null;
        }
      } catch (e) {
        console.log(`Endpoint ${endpoint} error:`, e.message);
        lastError = e;
        response = null;
      }
    }

    if (!response) {
      console.error("All endpoints failed");
      return res.status(502).json({ 
        error: "Could not reach AI service. Please try again.",
        details: lastError?.text || lastError?.message || "Unknown error"
      });
    }

    const data = await response.json();
    console.log("HuggingFace response:", JSON.stringify(data).substring(0, 200) + "...");

    // Parse response based on format
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    } else if (data[0]?.generated_text) {
      reply = data[0].generated_text;
    }

    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Extract only the assistant's reply (remove the prompt)
    const assistantReply = reply.split("[/INST]").pop()?.trim() || reply;

    return res.status(200).json({
      reply: assistantReply,
      model: "LLaMA-3-8B"
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "Internal server error: " + error.message });
  }
}
