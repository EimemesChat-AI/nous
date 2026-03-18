

📖 About

EimemesChat AI is an independent AI-powered conversational platform built with a focus on cultural representation. The application addresses users as "Melhoi" (a term of endearment meaning beautiful/handsome) and is developed with the long-term objective of supporting indigenous languages, including Kuki.

Mission: Preserving language is preserving identity.

---

🚀 Features

· AI-powered chat interface
· Google authentication
· Persistent chat history per user
· Dark/light mode support
· Rate limiting (30 messages per day)
· Conversation deletion
· Responsive design (mobile and desktop)
· Code block copy support
· Markdown rendering

---

🧱 Tech Stack

Layer Technology
Frontend HTML, CSS, JavaScript
Backend Node.js (serverless via Vercel)
AI Providers Groq / HuggingFace / OpenRouter
Authentication Firebase Auth (Google)
Database Firestore
Hosting Vercel (main app) + GitHub Pages (legal pages)
Version Control Git / GitHub

---

📁 Repository Structure

```
eimemeschat/
├── index.html                 # Main application
├── api/
│   └── chat.js                # Serverless AI endpoint
├── .env                       # Environment variables
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

Legal pages are maintained in a separate repository:
🔗 eimemeschat-legal

---

⚙️ Setup Instructions

1. Clone the repository

```bash
git clone https://github.com/yourusername/eimemeschat.git
cd eimemeschat
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

Create a .env file:

```env
HF_TOKEN=your_huggingface_token
GROQ_API_KEY=your_groq_api_key
OPENROUTER_KEY=your_openrouter_key
```

4. Configure Firebase

· Create a Firebase project
· Enable Google Authentication
· Set up Firestore
· Update Firebase config in index.html

5. Run locally

```bash
vercel dev
```

6. Deploy to production

```bash
vercel --prod
```

---

🔐 Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    match /users/{userId}/conversations/{convId} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

---

🌐 Live Links

Service URL
Main app https://eimemeschat-ai-ashy.vercel.app/
Legal Hub https://legal.eimemeschat.com

---

📄 Legal Pages

· About Us
· Privacy Policy
· Terms of Use
· FAQ & Support

---

💰 Operational Costs

The project is independently maintained. Ongoing costs include:

· API usage (per message)
· Domain and hosting
· Development and research toward Kuki language support

The service remains free for all users.

---

🛣️ Roadmap

Version Focus
v1.x Core chat experience, stability, community building
v2.0 Research and development toward Kuki language support
v3.0 Full conversational Kuki capabilities

---

📬 Contact

· Email: eimemeschatai@gmail.com
· Support: FAQ & Contact Form

---

🧾 License

© 2026 EimemesChat AI. All rights reserved.

---

🏔️ Motto

"Preserving language is preserving identity."
