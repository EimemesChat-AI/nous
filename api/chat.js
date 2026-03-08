// api/chat.js
import admin from "firebase-admin";

/* ── Firebase Admin (init once) ───────────────────────────────── */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores newlines as \n in env vars — replace them back
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

/* ── Constants ────────────────────────────────────────────────── */
const DAILY_LIMIT = 150;

/* ── Helpers ──────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10); }

async function checkAndIncrementDailyCount(uid) {
  const ref  = db.collection("users").doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  const today      = todayStr();
  const lastDate   = data.lastDate   || "";
  const dailyCount = lastDate === today ? (data.dailyCount || 0) : 0;

  if (dailyCount >= DAILY_LIMIT) return false;

  await ref.set({ dailyCount: dailyCount + 1, lastDate: today }, { merge: true });
  return true;
}

/* ── Handler ──────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  /* ── Auth: verify Firebase ID token ──────────────────────────── */
  const authHeader = req.headers.authorization || "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "Unauthorized. Please sign in." });

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid session. Please sign in again." });
  }

  /* ── Daily limit check ───────────────────────────────────────── */
  try {
    const allowed = await checkAndIncrementDailyCount(uid);
    if (!allowed) {
      return res.status(429).json({ error: "Daily limit reached. Your quota resets tomorrow." });
    }
  } catch (err) {
    console.error("Daily limit check failed:", err.message);
    // Fail open — don't block users if Firestore has a hiccup
  }

  /* ── Groq API call ───────────────────────────────────────────── */
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not set in Vercel environment variables." });

  const { message, history, personality } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const BASE = "You are EimemesChat, an AI assistant created by Eimemes AI Team. Address the user as Melhoi. When user asks to respond in Thadou Kuki, tell them you're still learning.";

  const PERSONALITIES = {
    friendly:   `${BASE} Be friendly, warm, funny and motivating. Use emojis naturally but don't overdo it. Crack a light joke when appropriate.`,
    professor:  `${BASE} Be formal, thorough and educational. Explain concepts in depth with examples. Use structured formatting. Minimal emojis.`,
    comedian:   `${BASE} Be hilarious and witty. Make jokes, use puns, roast gently, and keep things light-hearted. Use emojis liberally. Still be helpful but make it fun.`,
    direct:     `${BASE} Be extremely concise and direct. No fluff, no filler. Get straight to the point. Short sentences. No emojis unless essential.`,
    supportive: `${BASE} Be empathetic, kind and encouraging. Validate the user's feelings and efforts. Motivate them warmly. Use caring, supportive language.`,
    creative:   `${BASE} Be imaginative, expressive and think outside the box. Use vivid language, metaphors and creative approaches. Make responses feel fresh and unique.`,
  };

  const systemPrompt = PERSONALITIES[personality] || PERSONALITIES.friendly;

  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

  const MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ];

  // Set SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const title = (!history?.length) ? message.slice(0, 50) + (message.length > 50 ? "…" : "") : null;

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`[chat] Trying model: ${model}`);

      const groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6).map(({ role, content }) => ({ role, content })) : []),
            { role: "user", content: message },
          ],
          max_tokens: 600,
          temperature: 0.75,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.warn(`[${model}] Failed ${groqRes.status}: ${errText.slice(0,200)}, trying next...`);
        continue;
      }

      console.log(`✅ Streaming: ${model}`);

      const reader  = groqRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const token  = parsed.choices?.[0]?.delta?.content || "";
            if (token) {
              fullText += token;
              res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
          } catch {}
        }
      }

      // Send final metadata event
      res.write(`data: ${JSON.stringify({ done: true, model, ...(title && { title }), reply: fullText })}\n\n`);
      res.end();
      return;

    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") { console.warn(`[${model}] Timeout`); continue; }
      console.error(`[${model}] Error:`, err.message);
      continue;
    }
  }

  res.write(`data: ${JSON.stringify({ error: "All AI models failed. Please try again." })}\n\n`);
  res.end();
}

  
