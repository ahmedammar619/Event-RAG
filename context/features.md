# Additional Features

## Overview

This document covers additional features beyond the core moderator assignment functionality.

## Export Data

### Location

Admin Dashboard > Export Data (`/admin/export`)

### Available Exports

| Data | Filename | Contents |
|------|----------|----------|
| Moderators | `moderators_YYYY-MM-DD.csv` | ID, Name, Email, Phone, Preference, Created |
| Sessions | `sessions_YYYY-MM-DD.csv` | ID, Name, Date, Time, Room, Moderators Needed |
| Assignments | `assignments_YYYY-MM-DD.csv` | Session, Moderator, Date, Time, Room |
| Event Days | `event_days_YYYY-MM-DD.csv` | ID, Date, Start Time, End Time |
| Rooms | `rooms_YYYY-MM-DD.csv` | ID, Name, Capacity |

### Implementation

```javascript
// Export function pattern
const exportModerators = async () => {
  const response = await moderatorsService.getAll()
  const moderators = response.data.data

  const headers = ['ID', 'Name', 'Email', 'Phone', 'Preference', 'Created']
  const rows = moderators.map(m => [
    m.id,
    m.name,
    m.email,
    m.phone,
    m.schedule_preference,
    m.created_at
  ])

  downloadCSV(headers, rows, `moderators_${getDateString()}.csv`)
}

const downloadCSV = (headers, rows, filename) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
```

---

## Reset Event Data (Danger Zone)

### Location

Admin Dashboard > Export Data > Danger Zone (`/admin/export`)

### Purpose

Allows admin to clear all event data to start fresh for a new event while preserving admin accounts and event day configuration.

### What Gets Deleted

| Table | Deleted |
|-------|---------|
| Moderators | Yes |
| Availability | Yes |
| Sessions | Yes |
| Rooms | Yes |
| Assignments | Yes |
| Admins | **No** (preserved) |
| Event Days | **No** (preserved) |

### Double Confirmation Flow

**Step 1: Backup Prompt**
```
┌─────────────────────────────────────────┐
│  Backup Your Data First                 │
├─────────────────────────────────────────┤
│  [Download All Data (5 CSV files)]      │
│                                         │
│  This will permanently delete:          │
│  ✗ All registered moderators            │
│  ✗ All moderator availability           │
│  ✗ All sessions                         │
│  ✗ All rooms                            │
│  ✗ All assignments                      │
│                                         │
│  Preserved: Admin accounts, event days  │
│                                         │
│  [Cancel]  [Continue to Delete]         │
└─────────────────────────────────────────┘
```

**Step 2: Type Confirmation**
```
┌─────────────────────────────────────────┐
│  Final Confirmation                     │
├─────────────────────────────────────────┤
│  [Download Backup First]                │
│                                         │
│  Type DELETE ALL EVENT DATA to confirm: │
│  ┌─────────────────────────────────────┐│
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Go Back]  [Delete Everything]         │
└─────────────────────────────────────────┘
```

### Backend Endpoint

```javascript
// DELETE /api/admin/reset-event-data
fastify.delete('/reset-event-data', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const { confirmation } = request.body

  if (confirmation !== 'DELETE ALL EVENT DATA') {
    throw validationError('Invalid confirmation')
  }

  // Delete in order (foreign key constraints)
  const counts = {}
  counts.assignments = (await db.query('DELETE FROM assignments RETURNING id')).rowCount
  counts.availability = (await db.query('DELETE FROM availability RETURNING id')).rowCount
  counts.sessions = (await db.query('DELETE FROM sessions RETURNING id')).rowCount
  counts.moderators = (await db.query('DELETE FROM moderators RETURNING id')).rowCount
  counts.rooms = (await db.query('DELETE FROM rooms RETURNING id')).rowCount

  return success({
    message: 'All event data has been deleted successfully',
    deleted: counts
  })
})
```

---

## Toast Notifications

### Location

Global - Available throughout the application via `useToast()` hook

### Usage

```javascript
import { useToast } from '../context/ToastContext'

function MyComponent() {
  const toast = useToast()

  const handleSuccess = () => {
    toast.success('Operation completed!')
  }

  const handleError = () => {
    toast.error('Something went wrong')
  }

  const handleWarning = () => {
    toast.warning('Please check your input')
  }
}
```

### Toast Types

| Type | Color | Use Case |
|------|-------|----------|
| `success` | Green (#22c55e) | Successful operations |
| `error` | Red (#ef4444) | Errors, failures |
| `warning` | Amber (#f59e0b) | Warnings, cautions |

### Implementation

```javascript
// context/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((type, message) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const success = (message) => addToast('success', message)
  const error = (message) => addToast('error', message)
  const warning = (message) => addToast('warning', message)

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99999 }}>
        {toasts.map(toast => (
          <div key={toast.id} style={getToastStyle(toast.type)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

---

## Phone Number Formatting

### Location

Registration form (`/register`)

### Format

US phone format: `(XXX) XXX-XXXX`

### Features

- Auto-formats as user types
- Only allows digits
- Limits to 10 digits
- Validates for complete phone number

### Implementation

```javascript
const formatPhoneNumber = (value) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '')

  // Limit to 10 digits
  const limited = digits.slice(0, 10)

  // Format based on length
  if (limited.length === 0) return ''
  if (limited.length <= 3) return `(${limited}`
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
}

const handlePhoneChange = (e) => {
  const formatted = formatPhoneNumber(e.target.value)
  setForm({ ...form, phone: formatted })
}

// Validation
const validate = () => {
  const digits = form.phone.replace(/\D/g, '')
  if (digits.length !== 10) {
    errors.phone = 'Please enter a valid 10-digit US phone number'
  }
}
```

### Input Component

```jsx
<input
  type="tel"
  placeholder="(555) 123-4567"
  value={form.phone}
  onChange={handlePhoneChange}
/>
```

---

## Headcount Tracking

### Location

Moderator Portal > Schedule (`/portal`)

### Purpose

Moderators record attendance after sessions for event analytics.

### Input Options

1. **Exact Count**: Enter the actual number of attendees
2. **Percentage**: Estimate as percentage of room capacity (calculated automatically)

### Implementation

```javascript
// Frontend
<select onChange={e => setHeadcountType(e.target.value)}>
  <option value="count">Exact Count</option>
  <option value="percentage">% Full</option>
</select>

{headcountType === 'count' ? (
  <input
    type="number"
    value={headcount}
    onChange={e => setHeadcount(e.target.value)}
  />
) : (
  <select value={headcountPercentage} onChange={...}>
    <option value="25">25% Full (~{Math.round(room.capacity * 0.25)})</option>
    <option value="50">50% Full (~{Math.round(room.capacity * 0.50)})</option>
    <option value="75">75% Full (~{Math.round(room.capacity * 0.75)})</option>
    <option value="100">100% Full (~{room.capacity})</option>
  </select>
)}

// Backend
PATCH /api/sessions/:id/headcount
{
  "headcount": 150,          // Exact count
  "headcount_percentage": 75  // OR percentage (mutually exclusive)
}
```

---

## Schedule Preference

### Location

Moderator Portal > Availability (`/portal/availability`)

### Options

| Preference | Value | Description |
|------------|-------|-------------|
| Back-to-back | `consecutive` | Prefer sessions one after another |
| Spread out | `spread_out` | Prefer breaks between sessions |
| Flexible | `no_preference` | No preference (default) |

### Usage in Auto-Assignment

The algorithm considers preferences when scoring moderators:

```javascript
// If moderator prefers consecutive and has adjacent session
if (moderator.schedule_preference === 'consecutive') {
  if (hasAdjacentAssignment(moderator, session)) {
    score += 10  // Bonus for consecutive
  }
}

// If moderator prefers spread out
if (moderator.schedule_preference === 'spread_out') {
  if (!hasAdjacentAssignment(moderator, session)) {
    score += 10  // Bonus for gap
  }
}
```

---

## Moderator Lookup

### Location

`/lookup`

### Purpose

Allows returning moderators to access their portal without re-registering.

### Flow

1. User enters their email
2. System looks up moderator by email
3. If found, stores moderator in context and redirects to portal
4. If not found, shows error with link to register

### Implementation

```javascript
const handleLookup = async () => {
  try {
    const response = await moderatorsService.lookup(email)
    setModerator(response.data.data)
    navigate('/portal')
  } catch (err) {
    if (err.response?.status === 404) {
      toast.error('Email not found. Please register first.')
    }
  }
}
```

---

## Session Badges

### Location

Admin Dashboard > Sessions (`/admin/sessions`)

### Badge Types

| Status | Badge | Meaning |
|--------|-------|---------|
| Fully Assigned | Green `2/2` | All moderator slots filled |
| Partially Assigned | Yellow `1/2` | Some slots filled |
| Unassigned | Red `0/2` | No moderators assigned |

### Implementation

```jsx
<span className={`badge ${
  session.assigned_moderators.length >= session.moderators_needed
    ? 'badge-success'
    : 'badge-warning'
}`}>
  {session.assigned_moderators.length}/{session.moderators_needed}
</span>
```

---

## Bulk Operations

### Bulk Session Import

Admin can import multiple sessions at once via CSV or JSON.

### Bulk Availability Submit

Moderators can set availability for all days in one submission:

```javascript
POST /api/availability/bulk
{
  "moderator_id": 1,
  "slots": [
    { "event_day_id": 1, "start_time": "09:00", "end_time": "12:00" },
    { "event_day_id": 1, "start_time": "14:00", "end_time": "18:00" },
    { "event_day_id": 2, "start_time": "09:00", "end_time": "17:00" }
  ]
}
```

### Bulk Assignment Reset

Clear all assignments (with optional day filter):

```javascript
DELETE /api/assignments/reset
{
  "day_id": null  // null = all days, or specific day ID
}
```
