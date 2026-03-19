EimemesChat AI

A chat application powered by GROQ LLM with real-time streaming responses.

Features

· Real-time streaming - Tokens appear as they're generated
· Multiple LLM models with automatic fallback if one fails
· Conversation history - Auto-saved with AI-generated titles
· Code syntax highlighting with one-click copy
· Math rendering via KaTeX (LaTeX support)
· Dark/light theme with system preference sync
· Mobile responsive with touch-optimized UI

Tech Stack

· Frontend: Vanilla JS, Firebase SDK (auth + Firestore)
· Backend: Vercel serverless functions
· LLM: GROQ API (llama-3.1-8b, llama3-8b, etc.)
· Streaming: Server-Sent Events (SSE)

Setup

1. Clone the repo
2. Install dependencies: npm install
3. Add environment variables:
   ```
   GROQ_API_KEY=your_key
   FIREBASE_PROJECT_ID=your_project
   FIREBASE_CLIENT_EMAIL=your_email
   FIREBASE_PRIVATE_KEY="your_key"
   ```
4. Update Firebase config in index.html with your project details
5. Run: vercel dev

Environment Variables

Variable Description
GROQ_API_KEY API key from groq.com
FIREBASE_PROJECT_ID Firebase project ID
FIREBASE_CLIENT_EMAIL Firebase service account email
FIREBASE_PRIVATE_KEY Firebase private key

API Endpoint

POST /api/chat

Request body:

```json
{
  "message": "user question",
  "history": [{ "role": "user", "content": "..." }],
  "isFirstMessage": true/false
}
```

Response: Server-Sent Events stream with tokens

Models (in order)

1. llama-3.1-8b-instant (fastest)
2. llama3-8b-8192
3. llama-3.3-70b-versatile
4. gemma2-9b-it

Security

· Firebase Auth for user management
· Daily message limit: 150 per user
· Input sanitization
· System prompt leak detection
· User-scoped Firestore paths

License

MIT © Michael Kilong
