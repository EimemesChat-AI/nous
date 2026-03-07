// api/chat.js - Now with APPROVED LLaMA access!
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  if (!OPENROUTER_KEY) {
    console.error("OPENROUTER_KEY missing");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Build messages array with proper chat format
    const messages = [
      {
        role: "system",
        content: "You're EimemesChat, friendly and interactive. You always joke and motivate. Use emoji. Address user as Melhoi. Keep responses concise and engaging."
      }
    ];

    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    console.log("Sending to OpenRouter with LLaMA...");

    // ✅ Your LLaMA access is now approved!
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eimemeschat-ai-ashy.vercel.app",
        "X-Title": "EimemesChat AI"
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3-8B-Instruct", // No :free suffix needed now!
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter error:", response.status, errorData);
      
      // If LLaMA fails, try fallback model
      if (response.status === 404 || response.status === 401) {
        console.log("LLaMA failed, trying fallback...");
        const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://eimemeschat-ai-ashy.vercel.app",
            "X-Title": "EimemesChat AI"
          },
          body: JSON.stringify({
            model: "mistralai/mistral-7b-instruct:free",
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
          })
        });

        if (!fallbackResponse.ok) {
          return res.status(502).json({ error: "AI service temporarily unavailable" });
        }

        const fallbackData = await fallbackResponse.json();
        const fallbackReply = fallbackData.choices?.[0]?.message?.content;
        
        if (!fallbackReply) {
          return res.status(502).json({ error: "AI returned empty response" });
        }

        let title = null;
        if (!history || history.length === 0) {
          title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
        }

        return res.status(200).json({
          reply: fallbackReply,
          model: "Mistral (fallback)",
          ...(title && { title })
        });
      }
      
      return res.status(502).json({ error: `AI service error (${response.status})` });
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
      model: "LLaMA-3-8B",
      ...(title && { title })
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ 
      error: "Internal server error: " + error.message 
    });
  }
}
