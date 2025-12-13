# API Documentation

## Overview

The backend is a Fastify REST API that handles all data operations. All endpoints are prefixed with `/api`.

## Base URL

- **Local Development:** `http://localhost:3001/api`
- **Production:** `https://<railway-backend-url>/api`

## Authentication

Admin routes require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

Public routes (moderator registration, availability submission) do not require authentication.

## Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## Admin Routes

### POST /api/admin/login

Authenticate admin user.

**Request:**
```json
{
  "email": "admin@mascon.org",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "id": 1,
      "email": "admin@mascon.org",
      "name": "Admin User"
    }
  }
}
```

### GET /api/admin/dashboard

Get dashboard statistics. **Requires Auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "totalModerators": 25,
    "totalSessions": 40,
    "assignedSessions": 35,
    "unassignedSessions": 5,
    "eventDays": 3
  }
}
```

---

## Event Days

### GET /api/days

List all event days.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2025-03-15",
      "start_time": "09:00",
      "end_time": "18:00"
    },
    {
      "id": 2,
      "date": "2025-03-16",
      "start_time": "09:00",
      "end_time": "17:00"
    }
  ]
}
```

### POST /api/days

Create event day. **Requires Auth.**

**Request:**
```json
{
  "date": "2025-03-15",
  "start_time": "09:00",
  "end_time": "18:00"
}
```

### PUT /api/days/:id

Update event day hours. **Requires Auth.**

**Request:**
```json
{
  "start_time": "08:00",
  "end_time": "19:00"
}
```

### DELETE /api/days/:id

Delete event day. **Requires Auth.** Cascades to sessions and availability.

---

## Rooms

### GET /api/rooms

List all rooms.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Hall A", "capacity": 200 },
    { "id": 2, "name": "Room 101", "capacity": 50 }
  ]
}
```

### POST /api/rooms

Create room. **Requires Auth.**

**Request:**
```json
{
  "name": "Hall A",
  "capacity": 200
}
```

### PUT /api/rooms/:id

Update room. **Requires Auth.**

### DELETE /api/rooms/:id

Delete room. **Requires Auth.**

---

## Sessions

### GET /api/sessions

List all sessions with optional filters.

**Query Parameters:**
- `day_id` - Filter by event day
- `room_id` - Filter by room
- `assigned` - Filter by assignment status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Opening Keynote",
      "event_day_id": 1,
      "room_id": 1,
      "room_name": "Hall A",
      "date": "2025-03-15",
      "start_time": "09:00",
      "end_time": "10:30",
      "headcount": 0,
      "moderators_needed": 2,
      "assigned_moderators": [
        { "id": 1, "name": "John Doe" }
      ]
    }
  ]
}
```

### GET /api/sessions/:id

Get single session with full details.

### POST /api/sessions

Create session. **Requires Auth.**

**Request:**
```json
{
  "name": "Opening Keynote",
  "event_day_id": 1,
  "room_id": 1,
  "start_time": "09:00",
  "end_time": "10:30",
  "moderators_needed": 2
}
```

### PUT /api/sessions/:id

Update session. **Requires Auth.**

### PATCH /api/sessions/:id/headcount

Update session headcount. Can be called by assigned moderators.

**Request:**
```json
{
  "headcount": 150
}
```

### DELETE /api/sessions/:id

Delete session. **Requires Auth.**

### POST /api/sessions/bulk

Bulk import sessions. **Requires Auth.**

**Request:**
```json
{
  "sessions": [
    {
      "name": "Session 1",
      "event_day_id": 1,
      "room_id": 1,
      "start_time": "09:00",
      "end_time": "10:00",
      "moderators_needed": 1
    },
    {
      "name": "Session 2",
      "event_day_id": 1,
      "room_id": 2,
      "start_time": "09:00",
      "end_time": "10:00",
      "moderators_needed": 2
    }
  ]
}
```

---

## Moderators

### GET /api/moderators

List all moderators. **Requires Auth.**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "created_at": "2025-03-01T10:00:00Z",
      "total_availability_hours": 12,
      "assignment_count": 3
    }
  ]
}
```

### GET /api/moderators/:id

Get moderator details with availability and assignments.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "availability": [
      {
        "id": 1,
        "event_day_id": 1,
        "date": "2025-03-15",
        "start_time": "09:00",
        "end_time": "12:00"
      },
      {
        "id": 2,
        "event_day_id": 1,
        "date": "2025-03-15",
        "start_time": "14:00",
        "end_time": "18:00"
      }
    ],
    "assignments": [
      {
        "session_id": 1,
        "session_name": "Opening Keynote",
        "date": "2025-03-15",
        "start_time": "09:00",
        "end_time": "10:30",
        "room": "Hall A"
      }
    ]
  }
}
```

### POST /api/moderators/register

Register new moderator. **Public endpoint.**

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "token": "mod_abc123..."
  }
}
```

The token is used for moderator-specific actions (submitting availability, viewing assignments).

### PUT /api/moderators/:id

Update moderator info.

### DELETE /api/moderators/:id

Remove moderator. **Requires Auth.**

---

## Availability

### GET /api/availability/moderator/:id

Get moderator's availability slots.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "event_day_id": 1,
      "date": "2025-03-15",
      "day_start": "09:00",
      "day_end": "18:00",
      "start_time": "09:00",
      "end_time": "12:00"
    },
    {
      "id": 2,
      "event_day_id": 1,
      "date": "2025-03-15",
      "day_start": "09:00",
      "day_end": "18:00",
      "start_time": "14:00",
      "end_time": "18:00"
    }
  ]
}
```

### POST /api/availability

Submit availability slot.

**Request:**
```json
{
  "moderator_id": 1,
  "event_day_id": 1,
  "start_time": "09:00",
  "end_time": "12:00"
}
```

**Validation:**
- start_time must be >= event day's start_time
- end_time must be <= event day's end_time
- start_time must be < end_time

### POST /api/availability/bulk

Submit multiple availability slots at once.

**Request:**
```json
{
  "moderator_id": 1,
  "slots": [
    { "event_day_id": 1, "start_time": "09:00", "end_time": "12:00" },
    { "event_day_id": 1, "start_time": "14:00", "end_time": "18:00" },
    { "event_day_id": 2, "start_time": "09:00", "end_time": "17:00" }
  ]
}
```

### PUT /api/availability/:id

Update availability slot.

### DELETE /api/availability/:id

Delete availability slot.

---

## Assignments

### GET /api/assignments

List all assignments. **Requires Auth.**

**Query Parameters:**
- `session_id` - Filter by session
- `moderator_id` - Filter by moderator
- `day_id` - Filter by event day

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "session_id": 1,
      "session_name": "Opening Keynote",
      "moderator_id": 1,
      "moderator_name": "John Doe",
      "date": "2025-03-15",
      "start_time": "09:00",
      "end_time": "10:30",
      "room": "Hall A",
      "assigned_by": "auto",
      "assigned_at": "2025-03-10T15:30:00Z"
    }
  ]
}
```

### GET /api/assignments/session/:id

Get all moderators assigned to a session.

### GET /api/assignments/moderator/:id

Get all sessions assigned to a moderator.

### POST /api/assignments/auto

Run auto-assignment algorithm. **Requires Auth.**

**Request:**
```json
{
  "clear_existing": false,
  "day_id": null
}
```

- `clear_existing`: If true, clears all existing assignments first
- `day_id`: If provided, only auto-assign for that day

**Response:**
```json
{
  "success": true,
  "data": {
    "total_sessions": 40,
    "sessions_assigned": 38,
    "sessions_unassigned": 2,
    "total_assignments_created": 45,
    "unassigned_sessions": [
      { "id": 15, "name": "Late Night Session", "reason": "No available moderators" }
    ]
  }
}
```

### POST /api/assignments/manual

Manually assign moderator to session. **Requires Auth.**

**Request:**
```json
{
  "session_id": 1,
  "moderator_id": 5
}
```

**Validation:**
- Checks moderator is available during session time
- Checks moderator isn't already assigned to overlapping session
- Warns if session already has enough moderators (but allows override)

### DELETE /api/assignments/:id

Remove single assignment. **Requires Auth.**

### DELETE /api/assignments/reset

Clear all assignments. **Requires Auth.**

**Request:**
```json
{
  "day_id": null
}
```

- `day_id`: If provided, only clears assignments for that day

---

## Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Invalid input data |
| NOT_FOUND | Resource not found |
| DUPLICATE | Resource already exists |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| CONFLICT | Overlapping time slots |
| INTERNAL_ERROR | Server error |

## Rate Limiting

Public endpoints are rate limited:
- Registration: 10 requests per IP per hour
- Availability submission: 30 requests per moderator per hour

Admin endpoints are not rate limited but require authentication.
