// api/chat.js - COMPLETE WORKING VERSION
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

  // List of working free models on OpenRouter
  const freeModels = [
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "meta-llama/llama-3-8b-instruct:free"  // If your LLaMA access is approved
  ];

  // Try each model until one works
  let lastError = null;
  let response = null;
  let workingModel = null;

  for (const model of freeModels) {
    try {
      console.log(`Trying model: ${model}`);
      
      const fetchResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://eimemeschat-ai-ashy.vercel.app",
          "X-Title": "EimemesChat AI"
        },
        body: JSON.stringify({
          model: model,
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

      if (fetchResponse.ok) {
        response = fetchResponse;
        workingModel = model;
        console.log(`✅ Success with model: ${model}`);
        break;
      } else {
        const errorData = await fetchResponse.json();
        console.log(`❌ Model ${model} failed:`, errorData.error?.message);
        lastError = errorData;
      }
    } catch (e) {
      console.log(`Error with ${model}:`, e.message);
      lastError = e;
    }
  }

  if (!response) {
    console.error("All models failed:", lastError);
    return res.status(502).json({ 
      error: "AI service temporarily unavailable. Please try again later." 
    });
  }

  try {
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
      model: "EimemesChat AI",
      ...(title && { title })
    });

  } catch (error) {
    console.error("Error parsing response:", error);
    return res.status(500).json({ error: "Failed to parse AI response" });
  }
}
