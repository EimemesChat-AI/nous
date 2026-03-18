

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

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuth() && request.auth.uid == userId;
    }

    function isValidConversation() {
      let data = request.resource.data;
      return data.keys().hasAll(['title', 'createdAt', 'updatedAt', 'messages'])
        && data.title is string
        && data.title.size() <= 200
        && data.messages is list
        && data.messages.size() <= 100;
    }

    function isMetaUpdate() {
      let affected = request.resource.data.diff(resource.data).affectedKeys();
      return affected.hasOnly(['title', 'updatedAt']);
    }

    function isMessagesUpdate() {
      let affected = request.resource.data.diff(resource.data).affectedKeys();
      return affected.hasOnly(['messages', 'updatedAt'])
          || affected.hasOnly(['messages', 'updatedAt', 'title']);
    }

    match /users/{userId} {
      allow read:   if isOwner(userId);
      allow create: if isOwner(userId)
                    && request.resource.data.keys().hasOnly(['email', 'displayName', 'photoURL', 'createdAt']);
      allow update: if isOwner(userId)
                    && request.resource.data.keys().hasOnly(['email', 'displayName', 'photoURL', 'updatedAt']);
      allow delete: if isOwner(userId);

      match /conversations/{convId} {
        allow get:  if isOwner(userId);
        allow list: if isOwner(userId);
        
        allow create: if isOwner(userId)
                      && isValidConversation()
                      && request.resource.data.messages.size() == 0;
        
        allow update: if isOwner(userId)
                      && (isMessagesUpdate() || isMetaUpdate())
                      // Only validate title if it's being updated
                      && (!('title' in request.resource.data) || request.resource.data.title.size() <= 200)
                      // Only validate messages if they're being updated
                      && (!('messages' in request.resource.data) || request.resource.data.messages.size() <= 100);
        
        allow delete: if isOwner(userId);
      }
    }

    // Deny all other paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

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
