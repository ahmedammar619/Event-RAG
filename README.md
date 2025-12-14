# Moderation System

Moderation System Platform for MASCON Annual Event in Chicago. This platform helps coordinate volunteer moderators across event sessions with automated scheduling and assignment.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [User Flows](#user-flows)
- [Local Development](#local-development)
- [Docker Setup](#docker-setup)
- [Railway Deployment](#railway-deployment)
- [Environment Variables](#environment-variables)

---

## Overview

This platform solves the challenge of coordinating volunteer moderators for event sessions. Admins define event days and sessions, volunteers submit their availability, and the system auto-assigns moderators to sessions optimally.

### Key Capabilities

1. **Admin Dashboard**: Configure event days, time slots, and sessions
2. **Volunteer Portal**: Moderators input their availability (from/to times per day)
3. **Session Management**: Track sessions with name, time, room location, and headcount
4. **Auto-Assignment**: One-click algorithm to assign moderators to sessions based on availability
5. **Headcount Tracking**: Moderators can update session headcount after events

---

## Features

### For Admins
- Set available event days
- Define operating hours per day (threshold)
- Create/edit/delete sessions (name, time, room, date)
- View all registered moderators and their availability
- Run auto-assignment algorithm
- Manual assignment overrides
- Export assignments

### For Moderators
- Register with name, phone number, email
- Dedicated portal with sidebar navigation
- **Schedule tab**: View assigned sessions with times and rooms
- **Availability tab**: Set availability per day with 12-hour AM/PM time format
- Set schedule preference (back-to-back, spread out, or flexible)
- Update headcount for sessions (exact count or percentage of room capacity)
- Persistent sessions - stay logged in without timeout

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + Vite (JavaScript only, no TypeScript) |
| **Backend** | Fastify (Node.js) |
| **Database** | PostgreSQL (Railway hosted) |
| **Monorepo** | Nx |
| **Containerization** | Docker (2 containers: frontend, backend) |
| **Deployment** | Railway |

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
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd moderation-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development servers**
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend
npm run dev:backend
```

### Nx Commands
```bash
# Run frontend
npx nx serve frontend

# Run backend
npx nx serve backend

# Build all
npx nx run-many --target=build --all

# Run tests
npx nx run-many --target=test --all

# Lint
npx nx run-many --target=lint --all
```

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
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
      - CORS_ORIGIN=http://localhost:3000
```

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
```

### Frontend (`apps/frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

---

## Auto-Assignment Algorithm

The auto-assignment algorithm works as follows:

```javascript
// Pseudocode
function autoAssign() {
  sessions = getAllSessionsSortedByTime()

  for each session in sessions {
    availableModerators = findModeratorsAvailableDuring(
      session.event_day_id,
      session.start_time,
      session.end_time
    )

    // Score moderators (prefer those with fewer assignments)
    scoredModerators = availableModerators.map(m => ({
      moderator: m,
      score: calculateScore(m.totalAvailability, m.currentAssignments)
    }))

    // Sort by score (higher = more available, fewer assignments)
    scoredModerators.sort((a, b) => b.score - a.score)

    // Assign top N moderators
    toAssign = scoredModerators.slice(0, session.moderators_needed)
    for each moderator in toAssign {
      createAssignment(session.id, moderator.id, 'auto')
    }
  }
}
```

**Scoring factors:**
- Total available hours (more = higher score)
- Current assignment count (fewer = higher score)
- Avoid back-to-back sessions when possible

---

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

---

## Contact

For questions about the MASCON Annual Event moderation system, contact the event organizers.
