# RAG-based AI Session Finder - Implementation Documentation

## Overview

This document describes the complete implementation of a RAG (Retrieval Augmented Generation) system that allows event visitors to ask natural language questions like "I'm a convert, what session is a must see?" and receive personalized session recommendations with AI-generated reasoning.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │ Visitor Auth │  │ AI Chat Interface │  │ Session Cards + Reasoning │ │
│  │ /visitor/*   │  │ /explore          │  │ SessionCard.jsx           │ │
│  └──────────────┘  └──────────────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Fastify)                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │ /api/visitors  │  │ /api/ai/search  │  │ /api/ai/reasoning        │ │
│  │ (register/login)│  │ (vector search) │  │ (LLM recommendations)    │ │
│  └────────────────┘  └─────────────────┘  └──────────────────────────┘ │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                     │
│         ▼                    ▼                    ▼                     │
│  ┌─────────────┐    ┌───────────────┐    ┌──────────────────┐          │
│  │ Language    │    │ Embedding     │    │ LLM Service      │          │
│  │ Service     │    │ Service       │    │ (Ollama/gemma3)  │          │
│  │ (franc-min) │    │ (nomic-embed) │    │                  │          │
│  └─────────────┘    └───────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌──────────────┐              ┌──────────────────┐
            │ Main Postgres │              │ RAG Postgres     │
            │ (existing)    │              │ (pgvector)       │
            │ - admins      │              │ - sessions       │
            │ - moderators  │              │ - embeddings     │
            │ - sessions    │              │ - visitors       │
            │ - etc.        │              │ - ai_settings    │
            └──────────────┘              └──────────────────┘
```

---

## Dual-Mode Search System

The admin can toggle between two search modes:

### Mode A: Smart Hybrid Search (~800ms)
Best for complex queries like "morning sessions by Dr. Haifaa about family"

```
User Query → Detect Language → Translate (if Arabic) → LLM Parse Query
→ Extract Filters (speaker, time, track) → SQL Pre-Filter → Vector Search → Results
```

### Mode B: Direct Vector Search (~400ms)
Best for simple semantic queries like "sessions about spirituality"

```
User Query → Detect Language → Translate (if Arabic) → Generate Embedding
→ Vector Similarity Search → Results
```

### Two-Step Query Flow (Cost Optimization)
1. **Step 1**: Fast search returns results WITHOUT LLM reasoning
2. **User selects**: How many results to analyze (Top 5, Top 10, All)
3. **Step 2**: LLM generates personalized reasoning ONLY for selected results

This approach significantly reduces LLM API costs.

---

## Database Schema (RAG Database with pgvector)

### Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Visitors table (event attendees who use AI finder)
CREATE TABLE visitors (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table (imported from CSV with translations)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  track VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  room VARCHAR(255),
  description_original TEXT,      -- Original (may contain Arabic)
  description_english TEXT,       -- Translated to English
  speakers TEXT,
  session_type VARCHAR(50),
  tags TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session embeddings (768-dimensional vectors from nomic-embed-text-v2-moe)
CREATE TABLE session_embeddings (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  embedding vector(768),
  searchable_text TEXT,           -- The text that was embedded
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index (IVFFlat for 100+ rows, HNSW for smaller)
CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Query logs (analytics)
CREATE TABLE query_logs (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER REFERENCES visitors(id),
  query_original TEXT,
  query_english TEXT,
  detected_language VARCHAR(10),
  results_count INTEGER,
  search_mode VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI settings (admin configurable)
CREATE TABLE ai_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default settings
INSERT INTO ai_settings (key, value) VALUES
  ('search_mode', 'direct'),
  ('default_result_count', '5');
```

---

## Environment Variables

### Local Development (.env file)
```env
# Main Database (existing)
DATABASE_URL=postgres://user:pass@host:port/dbname

# RAG Database (pgvector)
RAG_DATABASE_URL=postgres://vewoz_rag:BbWnPojv~Dz8EhNBfFX~uQJdGLV6d6-6@switchback.proxy.rlwy.net:25350/vewoz_rag

# AI Services (Railway - Ollama)
OLLAMA_URL=https://ollama-production-2290.up.railway.app
OLLAMA_4B_URL=https://gemma3-4b-production.up.railway.app
EMBEDDING_URL=https://nomic-embed-text-production.up.railway.app

# Translation API (optional - falls back to Ollama)
LIBRETRANSLATE_URL=

# JWT Secret
JWT_SECRET=your-secret-key
```

### Railway Deployment Variables
Add these in Railway Dashboard → Service → Variables:
- `DATABASE_URL` - Main PostgreSQL connection
- `RAG_DATABASE_URL` - pgvector PostgreSQL connection
- `EMBEDDING_URL` - nomic-embed-text service URL
- `OLLAMA_URL` - Ollama LLM service URL
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - production
- `PORT` - 3001 (Railway sets dynamically)

---

## File Structure

```
apps/backend/
├── scripts/
│   ├── migrate-rag.js              # Creates RAG database tables
│   ├── translate-sessions.js       # Translates Arabic descriptions
│   └── import-sessions-rag.js      # Imports CSV + generates embeddings (batched)
├── src/
│   ├── plugins/
│   │   ├── db.js                   # Main database connection
│   │   └── ragDb.js                # RAG database connection (pgvector)
│   ├── services/
│   │   ├── embeddingService.js     # Generates embeddings via nomic-embed-text-v2-moe
│   │   ├── languageService.js      # Detects language + translates Arabic
│   │   ├── queryParserService.js   # LLM parses queries for Mode A
│   │   ├── ragService.js           # Core search logic (dual-mode)
│   │   └── aiSettingsService.js    # Admin settings CRUD
│   ├── routes/
│   │   ├── visitors.js             # Visitor auth (register/login)
│   │   ├── ai.js                   # AI search + reasoning endpoints
│   │   └── index.js                # Route registration
│   └── app.js                      # Main app with ragDb plugin

apps/frontend/
├── src/
│   ├── context/
│   │   └── VisitorContext.jsx      # Visitor auth state management
│   ├── pages/
│   │   ├── Visitor/
│   │   │   ├── Login.jsx           # Email-based visitor login
│   │   │   ├── Register.jsx        # Visitor registration
│   │   │   └── Explore.jsx         # Main AI chat interface
│   │   ├── Admin/
│   │   │   └── AISettings.jsx      # Admin mode toggle + settings
│   │   └── Public/
│   │       └── Landing.jsx         # Updated with visitor section
│   ├── components/
│   │   ├── explore/
│   │   │   ├── SessionCard.jsx     # Session display with reasoning
│   │   │   └── ResultCountSelector.jsx  # Top 5/10/All selector
│   │   └── layout/
│   │       └── AdminLayout.jsx     # Updated with AI Settings nav
│   ├── services/
│   │   └── api.js                  # Added visitorsService + aiService
│   ├── App.jsx                     # Added visitor routes
│   └── main.jsx                    # Added VisitorProvider
```

---

## Backend Services

### 1. embeddingService.js
Generates 768-dimensional vector embeddings using Ollama's nomic-embed-text-v2-moe model.

```javascript
// Single embedding
const embedding = await generateEmbedding("session about spirituality");
// Returns: [0.123, -0.456, ...] (768 floats)

// Batch embeddings (for import script)
const embeddings = await generateEmbeddingsBatch(["text1", "text2", ...]);
// Returns: [[...], [...], ...] (array of arrays)
```

**API Endpoint**: `POST {EMBEDDING_URL}/api/embed`
**Model**: `nomic-embed-text-v2-moe`
**Dimensions**: 768

### 2. languageService.js
Detects language and translates Arabic to English.

```javascript
const lang = detectLanguage("مرحبا");  // Returns: 'arabic'
const english = await translateToEnglish("مرحبا");  // Returns: 'Hello'
```

**Detection**: Uses `franc-min` library (instant, no API)
**Translation**: LibreTranslate (if configured) → Ollama fallback

### 3. queryParserService.js (Mode A only)
LLM extracts structured filters from natural language queries.

```javascript
const parsed = await parseQuery("morning sessions by Dr. Haifaa about family");
// Returns:
{
  topic: "family",
  speakers: ["Dr. Haifaa"],
  track: null,
  time_preference: "morning",
  language_preference: null
}
```

### 4. ragService.js
Core search logic with dual-mode support.

```javascript
// Auto-selects mode based on admin setting
const results = await searchSessions(ragDb, "I'm a convert", { limit: 15 });

// Generate LLM reasoning for selected sessions
const withReasoning = await generateReasoning(query, sessions);
```

### 5. aiSettingsService.js
CRUD for admin-configurable settings.

```javascript
const mode = await getSearchMode(ragDb);        // 'direct' or 'smart'
await setSearchMode(ragDb, 'smart');
const count = await getDefaultResultCount(ragDb); // 5, 10, 15, or 20
```

---

## API Endpoints

### Visitor Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/visitors/register` | Register new visitor | None |
| POST | `/api/visitors/login` | Email-based login | None |
| GET | `/api/visitors/me` | Get current visitor | JWT |

**Register Request:**
```json
{ "name": "John Doe", "email": "john@example.com" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "token": "eyJhbG..."
  }
}
```

### AI Search (Two-Step Flow)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/ai/search` | Step 1: Fast vector search | None |
| POST | `/api/ai/reasoning` | Step 2: Generate LLM reasoning | None |
| GET | `/api/ai/sessions` | List all sessions | None |
| GET | `/api/ai/sessions/:id` | Get single session | None |
| GET | `/api/ai/health` | Service health check | None |

**Search Request (Step 1):**
```json
{ "query": "I'm a convert, what sessions are best for me?" }
```

**Search Response:**
```json
{
  "success": true,
  "data": {
    "query_original": "I'm a convert...",
    "query_english": "I'm a convert...",
    "language_detected": "english",
    "mode": "direct",
    "total_matches": 15,
    "results": [
      {
        "session": {
          "id": 42,
          "title": "New Muslim Journey",
          "date": "2025-12-26",
          "time_start": "10:00:00",
          "time_end": "11:30:00",
          "track": "Convert Track",
          "room": "Hall A",
          "speakers": "Imam Suhaib Webb",
          "description_preview": "A session designed for..."
        },
        "relevance_score": 0.89
      }
      // ... more results
    ]
  }
}
```

**Reasoning Request (Step 2):**
```json
{
  "query": "I'm a convert...",
  "session_ids": [42, 15, 78, 23, 91]
}
```

**Reasoning Response:**
```json
{
  "success": true,
  "data": {
    "query": "I'm a convert...",
    "recommendations": [
      {
        "session": { /* full session data */ },
        "reasoning": "This session is perfect for you because it addresses the unique challenges new Muslims face...",
        "relevance_score": 0.89
      }
      // ... more with reasoning
    ]
  }
}
```

### Admin AI Settings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ai/settings` | Get all AI settings | Admin JWT |
| PUT | `/api/ai/settings/search-mode` | Toggle search mode | Admin JWT |
| PUT | `/api/ai/settings/result-count` | Set default result count | Admin JWT |

**Set Search Mode:**
```json
{ "mode": "smart" }  // or "direct"
```

---

## Frontend Components

### VisitorContext.jsx
Manages visitor authentication state with JWT.

```jsx
const { visitor, isAuthenticated, loading, login, register, logout } = useVisitor();
```

### Explore.jsx (Main AI Interface)
- Search input with example query chips
- Displays search results count
- ResultCountSelector for Top 5/10/All
- SessionCard list with AI reasoning
- Loading states for search and reasoning

### SessionCard.jsx
Displays session with:
- Rank badge (#1, #2, etc.)
- Title and track
- Date, time, room, speakers
- Relevance score percentage bar
- AI reasoning (purple box when available)

### ResultCountSelector.jsx
Buttons for selecting how many results to analyze:
- Quick (Top 5) - Lightning icon
- Detailed (Top 10) - Clipboard icon
- All Results - List icon

### AISettings.jsx (Admin Page)
- Service health status (embedding, language, parser)
- Search mode toggle (Direct vs Smart)
- Default result count buttons (5, 10, 15, 20)
- Cost optimization info box

---

## Scripts

### migrate-rag.js
Creates all RAG database tables and indexes.

```bash
npm run migrate:rag
```

### translate-sessions.js
Translates Arabic text in session descriptions to English.

```bash
npm run translate-sessions
```

Input: `agenda_cleaned.csv`
Output: `agenda_translated.csv`

### import-sessions-rag.js
Imports sessions and generates embeddings in batches.

```bash
npm run import-sessions:rag
```

**Features:**
- Batched embedding generation (20 sessions per API call)
- Only 12 API calls for 234 sessions (vs 234 individual calls)
- Creates appropriate vector index (IVFFlat or HNSW)

---

## Docker Configuration

### docker-compose.dev.yml (Local Development)
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile.dev
    ports:
      - "3001:3001"
    env_file:
      - .env    # Automatically loads all env vars
    environment:
      - PORT=3001
      - HOST=0.0.0.0
      - CORS_ORIGIN=http://localhost:3000
      - NODE_ENV=development
    volumes:
      - ./apps/backend/src:/app/src:delegated      # Hot reload
      - ./apps/backend/scripts:/app/scripts:delegated
```

### Hot Reload
- **Code changes**: Automatically reloads via volume mounts + `node --watch`
- **Env var changes**: Run `docker compose -f docker-compose.dev.yml up -d`

---

## Railway Services

| Service | URL | Purpose |
|---------|-----|---------|
| nomic-embed-text | https://nomic-embed-text-production.up.railway.app | Vector embeddings (768 dim) |
| gemma3:270m | https://ollama-production-2290.up.railway.app | LLM for reasoning + translation |
| gemma3-4b | https://gemma3-4b-production.up.railway.app | Higher quality LLM (optional) |

**Model Details:**
- Embedding: `nomic-embed-text-v2-moe` (768 dimensions, ~475M params)
- LLM: `gemma3:270m` for fast responses, `gemma3-4b` for better quality

---

## Frontend Routes

| Route | Component | Protection | Description |
|-------|-----------|------------|-------------|
| `/visitor/login` | Login.jsx | None | Visitor email login |
| `/visitor/register` | Register.jsx | None | Visitor registration |
| `/explore` | Explore.jsx | VisitorProtectedRoute | AI session finder |
| `/admin/ai-settings` | AISettings.jsx | AdminProtectedRoute | Admin AI config |

---

## User Flow

### Visitor Journey
1. User visits landing page → sees "Attending MASCON?" section
2. Clicks "Find Sessions with AI" → goes to `/visitor/login`
3. Enters email (or registers) → redirected to `/explore`
4. Types question like "sessions about spirituality"
5. Sees "Found 15 relevant sessions!"
6. Selects "Top 5" to analyze
7. AI generates personalized reasoning for top 5 sessions
8. User views SessionCards with explanations

### Admin Journey
1. Admin logs in → Dashboard
2. Clicks "AI Settings" in sidebar
3. Views service health status
4. Toggles between Direct/Smart search mode
5. Adjusts default result count

---

## Cost Optimization

The two-step flow reduces LLM costs significantly:

| Approach | LLM Calls per Search |
|----------|---------------------|
| Traditional (analyze all) | 15-20 calls |
| Two-step (user selects 5) | 1 batch call |

**Savings**: ~75-80% reduction in LLM API costs

---

## Troubleshooting

### RAG routes return 404
- Check if `RAG_DATABASE_URL` is set in environment
- Restart the backend server/Docker container
- Check logs for "RAG Database connected successfully"

### Embeddings fail with 404
- Verify `EMBEDDING_URL` is correct
- Check model name is `nomic-embed-text-v2-moe` (not `nomic-embed-text`)
- Test endpoint: `curl {EMBEDDING_URL}/api/tags`

### Search returns no results
- Verify sessions are imported: `SELECT COUNT(*) FROM sessions;`
- Verify embeddings exist: `SELECT COUNT(*) FROM session_embeddings;`
- Check vector index exists: `\di` in psql

### Arabic queries not translated
- LibreTranslate not configured → falls back to Ollama
- Check `OLLAMA_URL` is set and service is running
- Test: `curl {OLLAMA_URL}/api/tags`

---

## Summary of Created Files

### Backend (13 files)
1. `src/plugins/ragDb.js` - RAG database connection
2. `src/services/embeddingService.js` - Vector embedding generation
3. `src/services/languageService.js` - Language detection + translation
4. `src/services/queryParserService.js` - LLM query parsing
5. `src/services/ragService.js` - Core dual-mode search
6. `src/services/aiSettingsService.js` - Admin settings
7. `src/routes/visitors.js` - Visitor auth routes
8. `src/routes/ai.js` - AI search routes
9. `scripts/migrate-rag.js` - Database migration
10. `scripts/translate-sessions.js` - Arabic translation
11. `scripts/import-sessions-rag.js` - Batched import + embedding

### Frontend (8 files)
1. `src/context/VisitorContext.jsx` - Visitor auth state
2. `src/pages/Visitor/Login.jsx` - Login page
3. `src/pages/Visitor/Register.jsx` - Registration page
4. `src/pages/Visitor/Explore.jsx` - AI chat interface
5. `src/pages/Admin/AISettings.jsx` - Admin settings page
6. `src/components/explore/SessionCard.jsx` - Session display
7. `src/components/explore/ResultCountSelector.jsx` - Result count picker

### Modified Files
1. `src/routes/index.js` - Added visitor + AI routes
2. `src/app.js` - Added ragDb plugin
3. `src/services/api.js` - Added visitor + AI services
4. `src/App.jsx` - Added visitor routes + VisitorProtectedRoute
5. `src/main.jsx` - Added VisitorProvider
6. `src/pages/Public/Landing.jsx` - Added visitor section
7. `src/components/layout/AdminLayout.jsx` - Added AI Settings nav
8. `.env` - Added RAG environment variables
9. `docker-compose.dev.yml` - Added env_file directive
10. `docker-compose.yml` - Added env_file directive
11. `package.json` - Added scripts + franc-min dependency
