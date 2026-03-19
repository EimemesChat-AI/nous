```markdown
# EimemesChat AI

A chat application powered by GROQ LLM with real-time streaming responses.

---

## Features

- **Real-time streaming** - Tokens appear as they're generated
- **Multiple LLM models** with automatic fallback if one fails
- **Conversation history** - Auto-saved with AI-generated titles
- **Code syntax highlighting** with one-click copy
- **Math rendering** via KaTeX (LaTeX support)
- **Dark/light theme** with system preference sync
- **Mobile responsive** with touch-optimized UI

---

## Tech Stack

```javascript
{
  "frontend": "Vanilla JS + Firebase SDK",
  "backend": "Vercel serverless functions",
  "llm": "GROQ API (llama, gemma, etc.)",
  "streaming": "Server-Sent Events (SSE)"
}
```

---

Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/eimemeschat-ai.git
   cd eimemeschat-ai
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Add environment variables (.env.local)
   ```env
   GROQ_API_KEY=your_key_here
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_client_email
   FIREBASE_PRIVATE_KEY="your_private_key"
   ```
4. Update Firebase config in index.html
   ```javascript
   const firebaseConfig = {
     apiKey: "your_api_key",
     authDomain: "your_project.firebaseapp.com",
     projectId: "your_project_id",
     storageBucket: "your_project.appspot.com",
     messagingSenderId: "your_sender_id",
     appId: "your_app_id"
   };
   ```
5. Run locally
   ```bash
   vercel dev
   ```

---

Environment Variables

Variable Description
GROQ_API_KEY API key from groq.com
FIREBASE_PROJECT_ID Firebase project ID
FIREBASE_CLIENT_EMAIL Firebase service account email
FIREBASE_PRIVATE_KEY Firebase private key

---

API Endpoint

POST /api/chat

Request body:

```json
{
  "message": "user question",
  "history": [
    { "role": "user", "content": "previous message" }
  ],
  "isFirstMessage": true
}
```

Response: Server-Sent Events stream

```
data: {"token": "Hello"}
data: {"token": " world"}
data: {"done": true, "model": "llama-3.1-8b-instant"}
```

---

Models (in order)

Priority Model Speed
1 llama-3.1-8b-instant ⚡ Fastest
2 llama3-8b-8192 ⚡ Fast
3 llama-3.3-70b-versatile 🐢 Slower
4 gemma2-9b-it 🐢 Slower

---

Security Features

· ✅ Firebase Authentication
· ✅ Daily message limit (150 per user)
· ✅ Input sanitization
· ✅ System prompt leak detection
· ✅ User-scoped Firestore paths

---

Project Structure

```
├── api/
│   └── chat.js              # Main streaming endpoint
├── public/
│   └── index.html            # Single-page app
├── shield.js                  # Leak detection
├── knowledge.js               # Static knowledge base
├── vercel.json                # Vercel config
└── package.json               # Dependencies
```

---

License

```
MIT © Michael Kilong
```

---

Links

· Live Demo
· Support
· Privacy Policy
· Terms of Service

```
```
