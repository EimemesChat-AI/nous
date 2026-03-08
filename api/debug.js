// api/debug.js — DELETE THIS FILE after fixing. Only for diagnosis.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(200).json({ status: "❌ GROQ_API_KEY is NOT set in Vercel env vars." });
  }

  // Quick test call
  try {
    const testRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 20,
        stream: false,
      }),
    });

    const body = await testRes.text();
    return res.status(200).json({
      key_set: true,
      key_prefix: GROQ_API_KEY.slice(0, 8) + "...",
      groq_status: testRes.status,
      groq_response: body.slice(0, 600),
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
