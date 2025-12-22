# Vewoz Event RAG

Comprehensive event management platform for an Annual Event. Features **smart auto-assignment** for volunteer moderators and an **AI-powered RAG session finder** for attendees.

![Vewoz AutoAssigner Open Graph](apps/frontend/public/og-image.png)

## Two Core Features

### 1. Auto-Assignment System (Moderators)
One-click algorithm that optimally assigns volunteer moderators to sessions based on their availability, balancing workload across all volunteers.

```
Volunteers Register → Set Availability → Admin Clicks "Auto-Assign" → Done!
```

### 2. AI Session Finder (Visitors)
RAG-powered search that helps attendees discover relevant sessions using natural language queries like *"I'm a convert, what sessions should I attend?"*

```
Ask Question → Smart Search (Keyword + Vector) → AI Explains Why Each Session Matches
```

---

## Table of Contents

- [Features](#features)
- [Auto-Assignment Algorithm](#auto-assignment-algorithm)
- [AI Session Finder](#ai-session-finder)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [User Flows](#user-flows)
- [Local Development](#local-development)
- [Docker Setup](#docker-setup)
- [Railway Deployment](#railway-deployment)
- [Environment Variables](#environment-variables)

---

## Features

### For Admins
- Set available event days with operating hours
- Create/edit/delete rooms with capacity
- Create/edit/delete sessions (name, time, room, date, moderators needed)
- View all registered moderators and their availability
- **Run auto-assignment algorithm** with smart distribution
- Manual assignment overrides
- Export all data to CSV (moderators, sessions, assignments, etc.)
- Configure AI settings (search mode, LLM model, result count)
- Dashboard with real-time statistics

### For Moderators (Volunteers)
- Register with name, email, phone (US format auto-formatting)
- Dedicated portal with sidebar navigation
- **Schedule tab**: View assigned sessions with times and rooms
- **Availability tab**: Set availability per day with 12-hour AM/PM time format
- Set schedule preference (back-to-back, spread out, or flexible)
- Update headcount for sessions (exact count or percentage of room capacity)
- Persistent sessions - stay logged in without timeout

### For Visitors (Attendees)
- **AI Session Finder**: Natural language search for sessions
- Arabic + English support with automatic translation
- Personalized AI explanations for why each session matches
- Simple registration with email

---

## Auto-Assignment Algorithm

The system automatically assigns moderators to sessions with one click.

### How It Works
```
1. For each session (sorted by time):
   → Find all moderators available during that time slot
   → Score each moderator based on:
      • Total available hours (more = higher score)
      • Current assignment count (fewer = higher score)
      • Schedule preference (consecutive vs spread out)
   → Assign top N moderators (where N = moderators_needed)
   → Balance workload across all volunteers
```

### Scoring Formula
```javascript
score = (totalAvailableHours * 10) - (currentAssignments * 15) + preferenceBonus
```

### Features
- Respects moderator availability windows
- Balances assignments across all volunteers
- Considers schedule preferences (back-to-back vs spread out)
- Admin can manually override any assignment
- One-click reset to reassign all

---

## AI Session Finder

A RAG (Retrieval Augmented Generation) powered system that helps event visitors discover relevant sessions using natural language queries.

### Key Features
- **Natural Language Search**: Ask questions like "I'm a convert, what session is a must see?"
- **Arabic + English Support**: Automatic language detection and translation
- **Smart Search Modes**: Admin-toggleable Direct (fast) and Smart (hybrid) search
- **AI-Powered Reasoning**: Personalized explanations for why each session is relevant
- **Cost-Optimized**: Two-step query flow reduces LLM costs by 75%+

### Architecture

```
User Query → Language Detection → Translation (if Arabic)
     ↓
Hybrid Search:
  ├─ Keyword Search (ILIKE on title, speakers, track, description)
  └─ Vector Search (pgvector semantic similarity)
     ↓
Merge Results (keyword matches boosted to top)
     ↓
User Selects Count (Top 3/5/10/All)
     ↓
Grok API Reasoning → Personalized Session Cards
```

### AI Services

| Service | Purpose |
|---------|---------|
| **nomic-embed-text** | Vector embeddings (768 dimensions) - Railway hosted |
| **Grok API (xAI)** | LLM for reasoning and query parsing |
| **LibreTranslate** | Arabic → English translation (optional) |

### Search Modes

| Mode | Description | Latency |
|------|-------------|---------|
| **Hybrid (Default)** | Keyword matching + vector search for best results | ~500ms |
| **Smart** | LLM parses query → SQL filters → vector search | ~800ms |

**Hybrid Search Features:**
- Exact keyword matches rank highest (title, speakers, track, description)
- Semantic vector search finds related content
- Prevents irrelevant matches (e.g., "latino" won't match "katino")

### Visitor Flow
1. Visitor registers/logs in at `/visitor/login`
2. Asks a question at `/explore`
3. Selects how many results to analyze
4. Views sessions with AI-generated reasoning

### Admin Settings
- Select search pipeline (Smart Search / Search + AI / AI + Search + AI)
- Select LLM model (Grok Fast / Grok Reasoning)
- Set default result count (3, 5, 10, 15, 20)

For detailed implementation, see [context/rag-implementation.md](context/rag-implementation.md).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + Vite (JavaScript only, no TypeScript) |
| **Backend** | Fastify (Node.js) |
| **Database** | PostgreSQL (Railway hosted) + pgvector for RAG |
| **AI/LLM** | Grok API (xAI) for reasoning, nomic-embed-text for embeddings |
| **Monorepo** | Nx |
| **Containerization** | Docker (2 containers: frontend, backend) |
| **Deployment** | Railway |
| **Styling** | Tailwind CSS |

---

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd moderation-system

# Install dependencies
npm install
cd apps/frontend && npm install && cd ../..

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Start development environment
./dev.sh

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Default Admin Login
- Username: `admin`
- Password: `admin123`

---

## Documentation

Detailed documentation is available in the `context/` directory:

| Document | Description |
|----------|-------------|
| [overview.md](context/overview.md) | Project goals, problem/solution, key users |
| [frontend.md](context/frontend.md) | React architecture, routing, components |
| [backend.md](context/backend.md) | Fastify API, routes, middleware |
| [database.md](context/database.md) | PostgreSQL schema, tables, queries |
| [api.md](context/api.md) | Complete API documentation |
| [algorithm.md](context/algorithm.md) | Auto-assignment algorithm details |
| [user-flows.md](context/user-flows.md) | Step-by-step user journeys |
| [deployment.md](context/deployment.md) | Railway deployment guide |
| [development.md](context/development.md) | Local development setup |
| [styling.md](context/styling.md) | Tailwind CSS, theming, components |
| [features.md](context/features.md) | Additional features (export, reset, etc.) |
| [rag-implementation.md](context/rag-implementation.md) | AI Session Finder implementation details |

---

## Project Structure

```
moderation-system/
├── apps/
│   ├── frontend/                 # React + Vite app
│   │   ├── src/
│   │   │   ├── components/       # Reusable UI components
│   │   │   ├── pages/            # Page components
│   │   │   │   ├── Admin/        # Admin dashboard pages
│   │   │   │   ├── Moderator/    # Moderator portal pages
│   │   │   │   └── Public/       # Public landing/registration
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   ├── services/         # API service functions
│   │   │   ├── context/          # React context providers
│   │   │   ├── utils/            # Utility functions
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── Dockerfile            # Frontend container for Railway
│   │   └── package.json
│   │
│   └── backend/                  # Fastify API server
│       ├── src/
│       │   ├── routes/           # API route handlers
│       │   │   ├── admins.js
│       │   │   ├── moderators.js
│       │   │   ├── sessions.js
│       │   │   ├── availability.js
│       │   │   ├── assignments.js
│       │   │   └── days.js
│       │   ├── services/         # Business logic
│       │   │   ├── assignmentService.js  # Auto-assignment algorithm
│       │   │   └── validationService.js
│       │   ├── plugins/          # Fastify plugins
│       │   │   ├── db.js         # PostgreSQL connection
│       │   │   └── cors.js
│       │   ├── utils/            # Utility functions
│       │   └── app.js            # Fastify app setup
│       ├── migrations/           # Database migrations
│       ├── Dockerfile            # Backend container for Railway
│       └── package.json
│
├── libs/                         # Shared libraries (if needed)
│   └── shared/
│       └── constants.js
│
├── docker-compose.yml            # Local development orchestration
├── nx.json                       # Nx configuration
├── package.json                  # Root package.json
└── README.md
```

---

## Database Schema

### PostgreSQL Database: Railway
```
Connection String: postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/railway
```

### Tables

#### `admins`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| email | VARCHAR(255) UNIQUE | Admin email |
| password_hash | VARCHAR(255) | Hashed password |
| name | VARCHAR(255) | Admin name |
| created_at | TIMESTAMP | Creation timestamp |

#### `event_days`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| date | DATE UNIQUE | Event date |
| start_time | TIME | Day start time (threshold) |
| end_time | TIME | Day end time (threshold) |
| created_at | TIMESTAMP | Creation timestamp |

#### `rooms`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | Room name/location |
| capacity | INTEGER | Room capacity (optional) |
| created_at | TIMESTAMP | Creation timestamp |

#### `sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | Session name |
| event_day_id | INTEGER FK | Reference to event_days |
| room_id | INTEGER FK | Reference to rooms |
| start_time | TIME | Session start time |
| end_time | TIME | Session end time |
| headcount | INTEGER | Exact attendance count (if provided) |
| headcount_percentage | INTEGER | Attendance as % of room capacity (estimate) |
| moderators_needed | INTEGER | Number of moderators required |
| created_at | TIMESTAMP | Creation timestamp |

#### `moderators`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | Moderator name |
| email | VARCHAR(255) UNIQUE | Moderator email |
| phone | VARCHAR(50) | Phone number |
| schedule_preference | VARCHAR(20) | Preference: 'consecutive', 'spread_out', or 'no_preference' |
| created_at | TIMESTAMP | Registration timestamp |

#### `availability`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| moderator_id | INTEGER FK | Reference to moderators |
| event_day_id | INTEGER FK | Reference to event_days |
| start_time | TIME | Available from |
| end_time | TIME | Available until |
| created_at | TIMESTAMP | Creation timestamp |

#### `assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| session_id | INTEGER FK | Reference to sessions |
| moderator_id | INTEGER FK | Reference to moderators |
| assigned_at | TIMESTAMP | Assignment timestamp |
| assigned_by | VARCHAR(50) | 'auto' or 'manual' |

### Indexes
```sql
CREATE INDEX idx_availability_moderator ON availability(moderator_id);
CREATE INDEX idx_availability_day ON availability(event_day_id);
CREATE INDEX idx_sessions_day ON sessions(event_day_id);
CREATE INDEX idx_assignments_session ON assignments(session_id);
CREATE INDEX idx_assignments_moderator ON assignments(moderator_id);
```

---

## API Endpoints

### Admin Routes (`/api/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Admin login |
| GET | `/dashboard` | Dashboard stats |

### Event Days (`/api/days`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all event days |
| POST | `/` | Create event day with hours |
| PUT | `/:id` | Update day hours |
| DELETE | `/:id` | Delete event day |

### Rooms (`/api/rooms`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all rooms |
| POST | `/` | Create room |
| PUT | `/:id` | Update room |
| DELETE | `/:id` | Delete room |

### Sessions (`/api/sessions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all sessions |
| GET | `/:id` | Get session details |
| POST | `/` | Create session |
| PUT | `/:id` | Update session |
| PATCH | `/:id/headcount` | Update headcount (exact count or percentage) |
| DELETE | `/:id` | Delete session |
| POST | `/bulk` | Bulk import sessions |

### Moderators (`/api/moderators`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all moderators |
| GET | `/:id` | Get moderator details |
| POST | `/register` | Register new moderator |
| PUT | `/:id` | Update moderator info |
| DELETE | `/:id` | Remove moderator |

### Availability (`/api/availability`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/moderator/:id` | Get moderator's availability |
| POST | `/` | Submit availability slots |
| PUT | `/:id` | Update availability slot |
| DELETE | `/:id` | Delete availability slot |
| POST | `/bulk` | Bulk submit for multiple days |

### Assignments (`/api/assignments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all assignments |
| GET | `/session/:id` | Get session assignments |
| GET | `/moderator/:id` | Get moderator's assignments |
| POST | `/auto` | Run auto-assignment algorithm |
| POST | `/manual` | Manual assignment |
| DELETE | `/:id` | Remove assignment |
| DELETE | `/reset` | Clear all assignments |

---

## User Flows

### Flow 1: Admin Setup
```
1. Admin logs in
2. Admin creates event days with operating hours (threshold)
3. Admin creates rooms/locations
4. Admin creates sessions (name, day, room, time, moderators_needed)
5. Admin shares volunteer registration link
```

### Flow 2: Moderator Registration & Availability
```
1. Volunteer opens registration link
2. Enters: name, phone number, email
3. System shows available event days
4. For each day, volunteer enters availability:
   - Can add multiple time ranges (e.g., 9am-12pm, 2pm-5pm)
   - Only within admin-defined hours
5. Submits availability
6. Receives confirmation
```

### Flow 3: Auto-Assignment
```
1. Admin clicks "Auto-Assign" button
2. Algorithm runs:
   a. For each session, find available moderators
   b. Score moderators by total availability and current assignment count
   c. Assign up to moderators_needed per session
   d. Balance assignments across moderators
3. Admin reviews assignments
4. Admin can manually override if needed
5. Moderators notified of their assignments
```

### Flow 4: Event Day Operations
```
1. Moderators view their assigned sessions
2. After each session, moderator updates headcount
3. Admin can view real-time headcount data
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- npm

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd moderation-system
```

2. **Install dependencies**
```bash
npm install
cd apps/frontend && npm install && cd ../..
```

3. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
```

4. **Start development servers**
```bash
# Using the dev script (recommended)
./dev.sh

# This runs:
# - Backend in Docker on port 3001
# - Frontend locally with Vite on port 3000 (with hot reload)
```

### Seed Database

```bash
docker compose -f docker-compose.dev.yml exec backend node scripts/seed.js
```

### Common Commands

```bash
# View backend logs
docker compose -f docker-compose.dev.yml logs -f backend

# Restart backend
docker compose -f docker-compose.dev.yml restart backend

# Stop all services
docker compose -f docker-compose.dev.yml down

# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

For detailed development setup, see [context/development.md](context/development.md).

---

## Docker Setup

### Single Command Build (Local)
```bash
docker-compose up --build
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
```

**Note:** Context is set to root (`.`) for monorepo compatibility.

### Frontend Dockerfile (`apps/frontend/Dockerfile`)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

### Backend Dockerfile (`apps/backend/Dockerfile`)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "src/app.js"]
```

---

## Railway Deployment

### Prerequisites
- Railway account
- Railway CLI installed (`npm i -g @railway/cli`)

### Deployment Steps

1. **Database (Already configured)**
```
PostgreSQL URL: Set DATABASE_URL environment variable with your Railway connection string
```

2. **Deploy Backend**
```bash
cd apps/backend
railway login
railway init
railway up
```
Set environment variables in Railway dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - 3001
- `CORS_ORIGIN` - Frontend URL

3. **Deploy Frontend**
```bash
cd apps/frontend
railway init
railway up
```
Set environment variables:
- `VITE_API_URL` - Backend Railway URL

### Railway Service Configuration
Each service uses its own Dockerfile located in its directory.

---

## Environment Variables

### Backend (`apps/backend/.env`)
```env
# Database
DATABASE_URL=postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/railway

# RAG Database (pgvector)
RAG_DATABASE_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>

# Server
PORT=3001
HOST=0.0.0.0

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT (for admin auth)
JWT_SECRET=your-secret-key-here

# Admin Setup
ADMIN_EMAIL=admin@mascon.org
ADMIN_PASSWORD=initial-password

# AI Services
XAI_API_KEY=your-xai-api-key-here
EMBEDDING_URL=https://your-nomic-embed-text.up.railway.app
LIBRETRANSLATE_URL=https://your-libretranslate.up.railway.app  # Optional
```

### Frontend (`apps/frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

---

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

---

## Contact

- **Platform**: [Vewoz](https://vewoz.com)
- **Developer**: [Ahmed Ammar](https://ahmedammar.dev?mascon)
- **Event**: MASCON Annual Event, Chicago
