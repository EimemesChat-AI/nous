// api/chat.js - WORKING VERSION with DialoGPT (no approval needed)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) return res.status(500).json({ error: "Missing HF_TOKEN" });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Using DialoGPT-medium - instantly available, no approval needed
    const response = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: message,
          parameters: {
            max_length: 150,
            temperature: 0.7,
          },
        }),
      }
    );

    // Handle model loading
    if (response.status === 503) {
      return res.status(503).json({ 
        error: "Model is loading. Please wait 10 seconds and try again." 
      });
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("API error:", error);
      return res.status(502).json({ error: "AI service temporarily unavailable" });
    }

    const data = await response.json();
    
    // Extract the response
    let reply = "";
    if (Array.isArray(data)) {
      reply = data[0]?.generated_text || "";
    } else if (data.generated_text) {
      reply = data.generated_text;
    }

    // Clean up response (remove the input if it's repeated)
    if (reply.startsWith(message)) {
      reply = reply.substring(message.length).trim();
    }

    if (!reply) {
      reply = "Hi Melhoi! How can I help you today? 😊";
    }

    return res.status(200).json({
      reply: reply,
      model: "EimemesChat AI"
    });

  } catch (error) {
    console.error("Function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
