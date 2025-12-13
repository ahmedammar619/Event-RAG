# Database Schema

## Overview

The system uses PostgreSQL hosted on Railway. The database is designed to track events, sessions, moderators, their availability, and assignments.

## Connection

```
Host: <RAILWAY_HOST>
Port: <RAILWAY_PORT>
Database: railway
User: postgres
Password: <RAILWAY_PASSWORD>

Connection String:
postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/railway

Note: Get your actual credentials from Railway dashboard
```

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   admins    │       │ event_days  │       │    rooms    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ email       │       │ date        │       │ name        │
│ password    │       │ start_time  │       │ capacity    │
│ name        │       │ end_time    │       │ created_at  │
│ created_at  │       │ created_at  │       └──────┬──────┘
└─────────────┘       └──────┬──────┘              │
                             │                      │
                             │                      │
                    ┌────────┴────────┐            │
                    │                 │            │
              ┌─────▼─────┐    ┌──────▼────────────▼──┐
              │availability│    │      sessions        │
              ├───────────┤    ├──────────────────────┤
              │ id (PK)   │    │ id (PK)              │
              │ moderator │◄───┤ event_day_id (FK)    │
              │ event_day │    │ room_id (FK)         │
              │ start_time│    │ name                 │
              │ end_time  │    │ start_time           │
              │ created_at│    │ end_time             │
              └─────┬─────┘    │ headcount            │
                    │          │ moderators_needed    │
                    │          │ created_at           │
                    │          └──────────┬───────────┘
                    │                     │
              ┌─────▼─────┐               │
              │ moderators│               │
              ├───────────┤               │
              │ id (PK)   │               │
              │ name      │         ┌─────▼─────┐
              │ email     │         │assignments│
              │ phone     │         ├───────────┤
              │ created_at│◄────────┤ id (PK)   │
              └───────────┘         │ session_id│
                                    │ moderator │
                                    │ assigned  │
                                    │ assigned  │
                                    └───────────┘
```

## Tables

### admins

Stores admin user accounts for dashboard access.

```sql
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Admin login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hashed password |
| name | VARCHAR(255) | NOT NULL | Display name |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

### event_days

Defines event days with operating hours (the threshold).

```sql
CREATE TABLE event_days (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| date | DATE | UNIQUE, NOT NULL | Event date |
| start_time | TIME | NOT NULL | Day starts (e.g., 09:00) |
| end_time | TIME | NOT NULL | Day ends (e.g., 18:00) |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

**Example:**
```sql
INSERT INTO event_days (date, start_time, end_time)
VALUES ('2025-03-15', '09:00', '18:00');
```

### rooms

Room locations where sessions take place.

```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Room name (e.g., "Hall A") |
| capacity | INTEGER | NULLABLE | Room capacity |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

### sessions

Individual event sessions that need moderators.

```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    event_day_id INTEGER NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    headcount INTEGER DEFAULT 0,
    moderators_needed INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Session title |
| event_day_id | INTEGER | FK, NOT NULL | Which day |
| room_id | INTEGER | FK, NULLABLE | Which room |
| start_time | TIME | NOT NULL | Session start |
| end_time | TIME | NOT NULL | Session end |
| headcount | INTEGER | DEFAULT 0 | Actual attendance |
| moderators_needed | INTEGER | DEFAULT 1 | Required moderators |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

### moderators

Volunteer moderators who register to help.

```sql
CREATE TABLE moderators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Full name |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Contact email |
| phone | VARCHAR(50) | NULLABLE | Phone number |
| created_at | TIMESTAMP | DEFAULT NOW | Registration time |

### availability

Time slots when moderators are available.

```sql
CREATE TABLE availability (
    id SERIAL PRIMARY KEY,
    moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
    event_day_id INTEGER NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| moderator_id | INTEGER | FK, NOT NULL | Which moderator |
| event_day_id | INTEGER | FK, NOT NULL | Which day |
| start_time | TIME | NOT NULL | Available from |
| end_time | TIME | NOT NULL | Available until |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

**Note:** A moderator can have multiple availability rows per day (e.g., morning AND afternoon slots).

### assignments

Links moderators to sessions they are assigned to.

```sql
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) DEFAULT 'manual',
    UNIQUE(session_id, moderator_id)
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| session_id | INTEGER | FK, NOT NULL | Which session |
| moderator_id | INTEGER | FK, NOT NULL | Which moderator |
| assigned_at | TIMESTAMP | DEFAULT NOW | When assigned |
| assigned_by | VARCHAR(50) | DEFAULT 'manual' | 'auto' or 'manual' |

**Unique constraint** prevents assigning same moderator to same session twice.

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_availability_moderator ON availability(moderator_id);
CREATE INDEX idx_availability_day ON availability(event_day_id);
CREATE INDEX idx_availability_times ON availability(event_day_id, start_time, end_time);
CREATE INDEX idx_sessions_day ON sessions(event_day_id);
CREATE INDEX idx_sessions_times ON sessions(event_day_id, start_time, end_time);
CREATE INDEX idx_assignments_session ON assignments(session_id);
CREATE INDEX idx_assignments_moderator ON assignments(moderator_id);
```

## Common Queries

### Find available moderators for a session

```sql
SELECT m.*
FROM moderators m
JOIN availability a ON m.id = a.moderator_id
WHERE a.event_day_id = $1  -- session's event_day_id
  AND a.start_time <= $2   -- session's start_time
  AND a.end_time >= $3     -- session's end_time
  AND m.id NOT IN (
      SELECT ass.moderator_id
      FROM assignments ass
      JOIN sessions s ON ass.session_id = s.id
      WHERE s.event_day_id = $1
        AND s.start_time < $3
        AND s.end_time > $2
  );
```

### Get moderator's assignments

```sql
SELECT s.*, r.name as room_name, ed.date
FROM assignments a
JOIN sessions s ON a.session_id = s.id
JOIN rooms r ON s.room_id = r.id
JOIN event_days ed ON s.event_day_id = ed.id
WHERE a.moderator_id = $1
ORDER BY ed.date, s.start_time;
```

### Count assignments per moderator

```sql
SELECT m.id, m.name, COUNT(a.id) as assignment_count
FROM moderators m
LEFT JOIN assignments a ON m.id = a.moderator_id
GROUP BY m.id, m.name
ORDER BY assignment_count DESC;
```

## Migration Strategy

Migrations are stored in `apps/backend/migrations/` with timestamps:

```
migrations/
├── 001_create_admins.sql
├── 002_create_event_days.sql
├── 003_create_rooms.sql
├── 004_create_sessions.sql
├── 005_create_moderators.sql
├── 006_create_availability.sql
└── 007_create_assignments.sql
```

Run migrations on startup or via CLI command.
