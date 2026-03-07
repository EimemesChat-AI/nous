// api/chat.js - OPENROUTER with correct free model
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eimemeschat-ai-ashy.vercel.app",
        "X-Title": "EimemesChat AI"
      },
      body: JSON.stringify({
        // ✅ Correct model ID for free tier
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "system",
            content: "You're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi. Keep responses concise and engaging."
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter error:", response.status, errorData);
      
      // Specific handling for 404 (model not found)
      if (response.status === 404) {
        return res.status(502).json({ 
          error: "AI model temporarily unavailable. Please try again later." 
        });
      }
      
      return res.status(502).json({ 
        error: `AI service error (${response.status}). Please try again.` 
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    
    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Generate title for first message
    let title = null;
    if (!history || history.length === 0) {
      title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    }

    return res.status(200).json({
      reply: reply,
      model: "Mistral 7B (free)",
      ...(title && { title })
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ 
      error: "Internal server error: " + error.message 
    });
  }
}
