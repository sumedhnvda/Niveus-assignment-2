# 📚 Niveus Solutions — AI-Powered Book Management System

A full-stack book management platform with a multi-agent AI system built on LangGraph. Features an Admin portal for managing books and monitoring AI usage, and a User portal for browsing, reading, and chatting with AI about books.

## Architecture

- **Frontend**: Next.js 16 (App Router) + Vanilla CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (with GridFS for PDF storage)
- **Vector Store**: Qdrant Cloud
- **AI**: LangGraph multi-agent system with Google Gemini
- **Auth**: JWT-based with admin/user roles

## AI Agent System (LangGraph)

| Agent | Role |
|-------|------|
| 🎯 Supervisor | Routes queries, classifies intent |
| 📖 Recommender | Book recommendations based on preferences |
| 🔍 RAG QA | Answers from book content with citations |
| 📬 Book Request | Detects unavailable book requests, notifies admin |
| 🛡️ Moderator | Pre-screens messages for policy violations |
| 📝 Summarizer | Generates book summaries (cached in MongoDB) |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB running locally (or Atlas URI)
- OpenRouter API key

### Backend
```bash
cd backend

# Create and activate your virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables & Firebase Setup

1. **Backend**: 
   Check `backend/.env` and ensure it has:
   - `OPENROUTER_API_KEY` — Your OpenRouter API key
   - `LLM_MODEL` — The model to use (default: `deepseek/deepseek-v4-flash`)
   - `MONGODB_URL` — MongoDB connection string  
   - `QDRANT_URL` — Qdrant Cloud endpoint
   - `QDRANT_API_KEY` — Qdrant API key
   
   Ensure that `backend/firebase-adminsdk.json` is present for Firebase Admin initialization.

2. **Frontend**:
   Create `frontend/.env.local` with your Firebase client configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-id"
   NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
   ```

## Features

### Admin
- 📊 Dashboard with stats and agent usage breakdown
- 📚 Book CRUD with PDF upload (stored in MongoDB GridFS)
- 📈 LLM analytics: token usage per agent/user, daily trends
- 📬 Book request management (approve/reject/fulfill)
- 👥 User management with flagging and moderation logs

### User
- 📖 Browse library with search and genre filters
- 📄 In-browser PDF reader
- 📝 AI-powered book summaries (cached)
- 💬 AI chat with multiple agents (recommendations, Q&A, requests)
- 🔍 Source citations from book content
