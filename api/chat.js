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
const DAILY_LIMIT = 30;

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

  /* ── HuggingFace call ────────────────────────────────────────── */
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN not set in Vercel environment variables." });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const systemPrompt =
    "You are EimemesChat, a friendly and funny AI assistant. " + "Always respond first in English" + " Don't overuse emoji, use only in relevant conversation " +
    "Always use emojis, crack a joke, and motivate. " + "When user ask to respond in Thadou Kuki tell them you're still learning." + " You are created by Eimemes AI Team. Address the user as Melhoi.";

  const HF_URL = "https://router.huggingface.co/v1/chat/completions";

  const MODELS = [
    "meta-llama/Llama-3.2-3B-Instruct",
    "HuggingFaceH4/zephyr-7b-beta",
    "Qwen/Qwen2.5-7B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
  ];

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`[chat] Trying model: ${model}`);

      const hfRes = await fetch(HF_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: "user", content: message },
          ],
          max_tokens: 300,
          temperature: 0.75,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const rawText = await hfRes.text();
      console.log(`[${model}] status=${hfRes.status} body=${rawText.slice(0, 400)}`);

      if (hfRes.status === 503) {
        let t = 25;
        try { t = JSON.parse(rawText).estimated_time || 25; } catch {}
        return res.status(503).json({ error: `AI warming up ☕ Wait ~${Math.ceil(t)}s and retry.` });
      }

      if (!hfRes.ok) {
        console.warn(`[${model}] Failed with ${hfRes.status}, trying next...`);
        continue;
      }

      const data  = JSON.parse(rawText);
      const reply = data?.choices?.[0]?.message?.content?.trim() || "Hey Melhoi! 😊 Ask me anything!";
      const title = (!history?.length) ? message.slice(0, 50) + (message.length > 50 ? "…" : "") : null;

      console.log(`✅ Success: ${model}`);
      return res.status(200).json({ reply, model: model.split("/")[1], ...(title && { title }) });

    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") { console.warn(`[${model}] Timeout`); continue; }
      console.error(`[${model}] Error:`, err.message);
      continue;
    }
  }

  return res.status(502).json({
    error: "All AI models failed. Check /api/debug to diagnose your HF_TOKEN.",
  });
}
  
