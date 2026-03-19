<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EimemesChat AI · README</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      color: #24292e;
      background: #ffffff;
    }
    h1, h2, h3 {
      border-bottom: 1px solid #eaecef;
      padding-bottom: 0.3rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    h1 { font-size: 2.5rem; }
    h2 { font-size: 2rem; }
    h3 { font-size: 1.5rem; }
    code {
      background: #f6f8fa;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
      font-size: 0.9rem;
    }
    pre {
      background: #f6f8fa;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #e1e4e8;
    }
    pre code {
      background: none;
      padding: 0;
      font-size: 0.9rem;
    }
    hr {
      height: 1px;
      background: #eaecef;
      border: none;
      margin: 2rem 0;
    }
    blockquote {
      padding: 0 1rem;
      color: #6a737d;
      border-left: 0.25rem solid #dfe2e5;
      margin: 1rem 0;
    }
    ul, ol {
      padding-left: 2rem;
    }
    li {
      margin: 0.5rem 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      padding: 0.3rem 0.6rem;
      background: #f1f8ff;
      border-radius: 3px;
      font-size: 0.9rem;
      color: #0366d6;
      margin-right: 0.5rem;
    }
  </style>
</head>
<body>

<h1>EimemesChat AI</h1>

<p>A chat application powered by GROQ LLM with real-time streaming responses.</p>

<p>
  <span class="badge">Version 3.4</span>
  <span class="badge">MIT License</span>
  <span class="badge">Firebase</span>
  <span class="badge">GROQ</span>
</p>

<hr>

<h2>Features</h2>

<ul>
  <li><strong>Real-time streaming</strong> - Tokens appear as they're generated</li>
  <li><strong>Multiple LLM models</strong> with automatic fallback if one fails</li>
  <li><strong>Conversation history</strong> - Auto-saved with AI-generated titles</li>
  <li><strong>Code syntax highlighting</strong> with one-click copy</li>
  <li><strong>Math rendering</strong> via KaTeX (LaTeX support)</li>
  <li><strong>Dark/light theme</strong> with system preference sync</li>
  <li><strong>Mobile responsive</strong> with touch-optimized UI</li>
</ul>

<hr>

<h2>Tech Stack</h2>

<pre><code>{
  "frontend": "Vanilla JS + Firebase SDK",
  "backend": "Vercel serverless functions",
  "llm": "GROQ API (llama, gemma, etc.)",
  "streaming": "Server-Sent Events (SSE)"
}
</code></pre>

<hr>

<h2>Setup</h2>

<h3>1. Clone the repository</h3>

<pre><code>git clone https://github.com/yourusername/eimemeschat-ai.git
cd eimemeschat-ai
</code></pre>

<h3>2. Install dependencies</h3>

<pre><code>npm install
</code></pre>

<h3>3. Add environment variables (.env.local)</h3>

<pre><code>GROQ_API_KEY=your_key_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
</code></pre>

<h3>4. Update Firebase config in index.html</h3>

<pre><code>const firebaseConfig = {
  apiKey: "your_api_key",
  authDomain: "your_project.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id"
};
</code></pre>

<h3>5. Run locally</h3>

<pre><code>vercel dev
</code></pre>

<hr>

<h2>Environment Variables</h2>

<ul>
  <li><code>GROQ_API_KEY</code> - API key from <a href="https://groq.com">groq.com</a></li>
  <li><code>FIREBASE_PROJECT_ID</code> - Firebase project ID</li>
  <li><code>FIREBASE_CLIENT_EMAIL</code> - Firebase service account email</li>
  <li><code>FIREBASE_PRIVATE_KEY</code> - Firebase private key</li>
</ul>

<hr>

<h2>API Endpoint</h2>

<h3>POST /api/chat</h3>

<p><strong>Request body:</strong></p>

<pre><code>{
  "message": "user question",
  "history": [
    { "role": "user", "content": "previous message" }
  ],
  "isFirstMessage": true
}
</code></pre>

<p><strong>Response:</strong> Server-Sent Events stream</p>

<pre><code>data: {"token": "Hello"}
data: {"token": " world"}
data: {"done": true, "model": "llama-3.1-8b-instant"}
</code></pre>

<hr>

<h2>Models (in order)</h2>

<ol>
  <li><code>llama-3.1-8b-instant</code> (fastest)</li>
  <li><code>llama3-8b-8192</code></li>
  <li><code>llama-3.3-70b-versatile</code></li>
  <li><code>gemma2-9b-it</code></li>
</ol>

<hr>

<h2>Security</h2>

<ul>
  <li>Firebase Authentication</li>
  <li>Daily message limit (150 per user)</li>
  <li>Input sanitization</li>
  <li>System prompt leak detection</li>
  <li>User-scoped Firestore paths</li>
</ul>

<hr>

<h2>Project Structure</h2>

<pre><code>├── api/
│   └── chat.js              # Main streaming endpoint
├── public/
│   └── index.html            # Single-page app
├── shield.js                  # Leak detection
├── knowledge.js               # Static knowledge base
├── vercel.json                # Vercel config
└── package.json               # Dependencies
</code></pre>

<hr>

<h2>License</h2>

<p>MIT © Michael Kilong</p>

<hr>

<h2>Links</h2>

<ul>
  <li><a href="https://app-eimemeschat.vercel.app">Live Demo</a></li>
  <li><a href="https://app-eimemeschat.vercel.app/support.html">Support</a></li>
  <li><a href="https://app-eimemeschat.vercel.app/privacy.html">Privacy Policy</a></li>
  <li><a href="https://app-eimemeschat.vercel.app/terms.html">Terms of Service</a></li>
</ul>

</body>
</html>
