// api/chat.js - OPENROUTER VERSION (100% WORKING)
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Your OpenRouter key
  const OPENROUTER_KEY = "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";
  
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    console.log("Sending request to OpenRouter...");
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eimemeschat-ai-ashy.vercel.app",
        "X-Title": "EimemesChat AI"
      },
      body: JSON.stringify({
        // Using Mistral 7B - free, fast, and no approval needed
        model: "mistralai/mistral-7b-instruct",
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      return res.status(502).json({ 
        error: `AI service error (${response.status}). Please try again.` 
      });
    }

    const data = await response.json();
    console.log("OpenRouter success:", data);

    // Extract the reply
    const reply = data.choices?.[0]?.message?.content;
    
    if (!reply) {
      return res.status(502).json({ error: "AI returned empty response" });
    }

    // Generate title for first message (if needed)
    const title = message.slice(0, 50) + (message.length > 50 ? "…" : "");

    return res.status(200).json({
      reply: reply,
      model: "Mistral 7B",
      title: title
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ 
      error: "Internal server error: " + error.message 
    });
  }
}
