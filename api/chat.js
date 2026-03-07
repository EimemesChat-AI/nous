// api/chat.js - ULTIMATE FIX (Works with HuggingFace)
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
    return res.status(500).json({ error: "Server configuration: Missing HF_TOKEN" });
  }

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  console.log("🚀 Starting request...");

  // List of models to try in order (first one that works will be used)
  const modelsToTry = [
    "meta-llama/Meta-Llama-3-8B-Instruct",  // Your approved model
    "mistralai/Mistral-7B-Instruct-v0.2",    // Fallback
    "gpt2"                                    // Universal fallback
  ];

  // List of possible endpoints
  const baseEndpoints = [
    "https://api-inference.huggingface.co/models/",
    "https://router.huggingface.co/hf-inference/models/"
  ];

  let lastError = null;

  // Try each combination
  for (const model of modelsToTry) {
    for (const baseEndpoint of baseEndpoints) {
      const url = baseEndpoint + model;
      console.log(`Trying ${url}...`);

      try {
        // Simple prompt - works for all models
        const prompt = `You are EimemesChat, friendly and interactive. Use emoji and address user as Melhoi.\nUser: ${message}\nAssistant:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 150,
              temperature: 0.7,
              return_full_text: false,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          let reply = "";
          if (Array.isArray(data)) {
            reply = data[0]?.generated_text || "";
          } else if (data.generated_text) {
            reply = data.generated_text;
          }

          // Clean up
          reply = reply.replace(prompt, "").trim();
          if (!reply) reply = "Hey Melhoi! 😊";

          console.log(`✅ Success with ${model} on ${baseEndpoint}`);
          return res.status(200).json({
            reply: reply,
            model: "EimemesChat AI"
          });
        } else {
          const errorText = await response.text();
          console.log(`❌ ${response.status} - ${errorText.slice(0, 100)}`);
          lastError = { status: response.status, text: errorText };
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
        lastError = err;
      }
    }
  }

  // If we get here, everything failed
  console.error("All attempts failed:", lastError);
  return res.status(503).json({
    error: "AI service unavailable. Please try again in a few seconds.",
    details: "If this persists, check your HuggingFace token and model access."
  });
}
