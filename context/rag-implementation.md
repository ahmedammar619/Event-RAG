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
│  │ Service     │    │ Service       │    │ (Grok API)       │          │
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
  title_english VARCHAR(500),           -- v2: Translated title
  room VARCHAR(255),
  description_original TEXT,            -- Original (may contain Arabic)
  description_english TEXT,             -- Translated to English
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
  searchable_text TEXT,                 -- The text that was embedded
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
  ('default_result_count', '5'),
  ('llm_model', 'gemma3:270m'),
  ('reasoning_mode', 'full');
```

---

## Environment Variables

> **IMPORTANT: Never commit real credentials to version control**

### Required Variables
Configure these in your local `.env` file or deployment secrets:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Main PostgreSQL connection | `postgres://user:pass@host:port/dbname` |
| `RAG_DATABASE_URL` | pgvector PostgreSQL connection | `postgres://user:pass@host:port/ragdb` |
| `XAI_API_KEY` | Grok API key (xAI) for LLM | `xai-xxxxxxxxxxxx` |
| `EMBEDDING_URL` | nomic-embed-text service | `https://your-embedding.example.com` |
| `JWT_SECRET` | JWT signing secret | `your-random-secret-key` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Backend port | `3001` |

### Optional Variables
| Variable | Description |
|----------|-------------|
| `LIBRETRANSLATE_URL` | Translation API (optional) |
| `CORS_ORIGIN` | Frontend URL for CORS |

---

## File Structure

```
apps/backend/
├── scripts/
│   ├── migrate-rag.js              # Creates RAG database tables
│   ├── migrate-rag-v2.js           # v2 schema updates
│   ├── translate-sessions.js       # Translates Arabic descriptions
│   ├── translate-titles.js         # v2: Translates Arabic titles
│   ├── import-sessions-rag.js      # Imports CSV + generates embeddings
│   └── regenerate-embeddings.js    # v2: Regenerate with translations
├── src/
│   ├── plugins/
│   │   ├── db.js                   # Main database connection
│   │   └── ragDb.js                # RAG database connection (pgvector)
│   ├── services/
│   │   ├── embeddingService.js     # Generates embeddings via nomic-embed-text-v2-moe
│   │   ├── languageService.js      # Detects language + translates Arabic
│   │   ├── llmService.js           # Grok API integration for LLM calls
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
Generates 768-dimensional vector embeddings using nomic-embed-text-v2-moe model.

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

### 3. llmService.js
Centralized Grok API integration for all LLM calls.

```javascript
import { generateCompletion } from './llmService.js';

const response = await generateCompletion("What is 2+2?", {
  model: 'grok-fast',      // 'grok-fast', 'grok-mini', or 'grok-4'
  systemPrompt: "You are a helpful assistant.",
  maxTokens: 500,
  temperature: 0.7
});
```

**Available Models:**
| Model | ID | Use Case |
|-------|----|----------|
| `grok-fast` | `grok-4-1-fast-non-reasoning` | Default, fast responses, best for query parsing |
| `grok-reasoning` | `grok-4-1-fast-reasoning` | Better explanations with chain-of-thought |

### 4. queryParserService.js (Mode A only)
Uses Grok API to extract structured filters from natural language queries.

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

### 5. ragService.js
Core search logic with dual-mode support. Uses Grok API via llmService for reasoning.

```javascript
// Auto-selects mode based on admin setting
const results = await searchSessions(ragDb, "I'm a convert", { limit: 15 });

// Generate LLM reasoning for selected sessions
const withReasoning = await generateReasoning(ragDb, query, sessions);
```

### 6. aiSettingsService.js
CRUD for admin-configurable settings.

```javascript
const mode = await getSearchMode(ragDb);           // 'direct' or 'smart'
const llmModel = await getLlmModel(ragDb);         // 'grok-fast' or 'grok-reasoning'
const reasoningMode = await getReasoningMode(ragDb); // 'full' or 'embedding_only'
const count = await getDefaultResultCount(ragDb);  // 3, 5, 10, 15, or 20
```

---

## API Endpoints

### Visitor Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/visitors/register` | Register new visitor | None |
| POST | `/api/visitors/login` | Email-based login | None |
| GET | `/api/visitors/me` | Get current visitor | JWT |

### AI Search (Two-Step Flow)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/ai/search` | Step 1: Fast vector search | None |
| POST | `/api/ai/reasoning` | Step 2: Generate LLM reasoning | None |
| GET | `/api/ai/sessions` | List all sessions | None |
| GET | `/api/ai/sessions/:id` | Get single session | None |
| GET | `/api/ai/health` | Service health check | None |

### Admin AI Settings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ai/settings` | Get all AI settings | Admin JWT |
| PUT | `/api/ai/settings/search-mode` | Toggle search mode | Admin JWT |
| PUT | `/api/ai/settings/result-count` | Set default result count | Admin JWT |
| PUT | `/api/ai/settings/llm-model` | Set LLM model | Admin JWT |
| PUT | `/api/ai/settings/reasoning-mode` | Set reasoning mode | Admin JWT |
| GET | `/api/ai/analytics` | Get search analytics | Admin JWT |

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
- ResultCountSelector for Top 5/10/All (when reasoning_mode is 'full')
- SessionCard list with AI reasoning
- Loading states for search and reasoning
- Embedding-only mode shows results directly

### SessionCard.jsx
Displays session with:
- Rank badge (#1, #2, etc.)
- Title and track
- Date, time, room, speakers
- Relevance score percentage bar
- "AI Take" section (purple gradient when reasoning available)

### ResultCountSelector.jsx
Buttons for selecting how many results to analyze:
- Quick (Top 5) - Lightning icon
- Detailed (Top 10) - Clipboard icon
- All Results - List icon

### AISettings.jsx (Admin Page)
Responsive table format with:
- Search Pipeline cards (Smart Search / Search + AI / AI + Search + AI)
- LLM Model selection (Grok Fast / Grok Reasoning)
- Default Result Count buttons (3, 5, 10, 15, 20)
- Analytics summary (last 7 days)
- Mobile-first responsive design

---

## Scripts

### migrate-rag.js
Creates all RAG database tables and indexes.

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/migrate-rag.js
```

### migrate-rag-v2.js
Adds v2 schema changes (title_english, new settings, analytics).

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/migrate-rag-v2.js
```

### translate-titles.js
Translates Arabic titles to English.

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/translate-titles.js
```

### import-sessions-rag.js
Imports sessions and generates embeddings in batches.

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/import-sessions-rag.js
```

### regenerate-embeddings.js
Regenerates all embeddings with translated titles.

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/regenerate-embeddings.js
```

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

## External Services

| Service | Purpose |
|---------|---------|
| nomic-embed-text | Vector embeddings (768 dimensions) - Railway hosted |
| Grok API (xAI) | LLM for reasoning + query parsing |
| LibreTranslate | Arabic → English translation (optional) |

**Model Details:**
- **Embedding**: `nomic-embed-text-v2-moe` (768 dimensions, ~475M params) - Self-hosted on Railway
- **LLM**: Grok API with `grok-fast` ($0.20/$0.50 per 1M tokens) as default, `grok-4` for higher quality

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
6. Selects "Top 5" to analyze (if reasoning_mode is 'full')
7. AI generates personalized reasoning for top 5 sessions
8. User views SessionCards with explanations

### Admin Journey
1. Admin logs in → Dashboard
2. Clicks "AI Settings" in sidebar
3. Views service health status
4. Configures search mode, LLM model, reasoning mode
5. Adjusts default result count

---

## Cost Optimization

### Two-Step Flow Savings
| Approach | LLM Calls per Search |
|----------|---------------------|
| Traditional (analyze all) | 15-20 calls |
| Two-step (user selects 5) | 1 batch call |

**Savings**: ~75-80% reduction in LLM API costs

### Embedding-Only Mode
- **Full mode**: AI generates personalized reasoning
- **Embedding-only**: Pure vector similarity, zero LLM costs

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

---

## Version History

### v1.0 - Initial Implementation
- Dual-mode search (Direct/Smart)
- Two-step query flow
- Visitor authentication
- Session embeddings with pgvector

### v2.0 - Enhanced Features
- LLM model selection (gemma3:270m/gemma3-4b)
- Embedding-only reasoning mode
- Title translation (Arabic → English)
- Enhanced analytics table
- "AI Take" UI branding

### v3.0 - Grok API Migration
- Migrated from self-hosted Ollama to Grok API (xAI)
- Added centralized `llmService.js` for all LLM calls
- Updated model options: `grok-fast`, `grok-mini`, `grok-4`
- Added default result count option starting from 3
- Responsive design for AISettings page
- Enhanced analytics: IP address, device type, browser, OS tracking
- Fixed visitor token priority for search routes
- SSL connection fallback for Railway databases

---

## Summary of Files

### Backend Scripts
| File | Purpose |
|------|---------|
| `migrate-rag.js` | Database migration v1 |
| `migrate-rag-v2.js` | Database migration v2 |
| `translate-sessions.js` | Translate descriptions |
| `translate-titles.js` | Translate titles |
| `import-sessions-rag.js` | Import + embed sessions |
| `regenerate-embeddings.js` | Regenerate embeddings |

### Backend Services
| File | Purpose |
|------|---------|
| `ragDb.js` | RAG database connection (SSL fallback) |
| `embeddingService.js` | Vector embedding generation |
| `languageService.js` | Language detection + translation |
| `llmService.js` | Grok API integration for LLM calls |
| `queryParserService.js` | LLM query parsing (uses llmService) |
| `ragService.js` | Core dual-mode search (uses llmService) |
| `aiSettingsService.js` | Admin settings CRUD |

### Frontend Components
| File | Purpose |
|------|---------|
| `VisitorContext.jsx` | Visitor auth state |
| `Explore.jsx` | AI chat interface |
| `AISettings.jsx` | Admin settings page |
| `SessionCard.jsx` | Session display |
| `ResultCountSelector.jsx` | Result count picker |
