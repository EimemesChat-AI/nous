// api/debug.js — DELETE THIS FILE after fixing. Only for diagnosis.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(200).json({ status: "❌ HF_TOKEN is NOT set in Vercel env vars." });
  }

  // Quick test call with a tiny model
  try {
    const testRes = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.2-3B-Instruct",
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 20,
        stream: false,
      }),
    });

    const body = await testRes.text();
    return res.status(200).json({
      token_set: true,
      token_prefix: HF_TOKEN.slice(0, 8) + "...",
      hf_status: testRes.status,
      hf_response: body.slice(0, 600),
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
