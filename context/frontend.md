# Frontend Architecture

## Overview

The frontend is a React + Vite single-page application (SPA) using JavaScript only (no TypeScript). It provides interfaces for both admins and moderators.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| React Router | Client-side routing |
| Axios | HTTP client |
| CSS Modules / Tailwind | Styling (TBD) |

## Project Structure

```
apps/frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/           # Shared components
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Loading.jsx
│   │   │   └── Toast.jsx
│   │   ├── layout/           # Layout components
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   └── PublicLayout.jsx
│   │   └── forms/            # Form components
│   │       ├── TimeRangePicker.jsx
│   │       ├── DatePicker.jsx
│   │       └── SessionForm.jsx
│   │
│   ├── pages/                # Page components
│   │   ├── Admin/            # Admin dashboard pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── EventDays.jsx
│   │   │   ├── Rooms.jsx
│   │   │   ├── Sessions.jsx
│   │   │   ├── Moderators.jsx
│   │   │   ├── Assignments.jsx
│   │   │   └── Login.jsx
│   │   ├── Moderator/        # Moderator portal pages
│   │   │   ├── MyAssignments.jsx
│   │   │   ├── UpdateHeadcount.jsx
│   │   │   └── Profile.jsx
│   │   └── Public/           # Public pages
│   │       ├── Landing.jsx
│   │       ├── Register.jsx
│   │       └── Availability.jsx
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useApi.js
│   │   ├── useAuth.js
│   │   ├── useModerator.js
│   │   └── useToast.js
│   │
│   ├── services/             # API service functions
│   │   ├── api.js            # Axios instance
│   │   ├── adminService.js
│   │   ├── dayService.js
│   │   ├── roomService.js
│   │   ├── sessionService.js
│   │   ├── moderatorService.js
│   │   ├── availabilityService.js
│   │   └── assignmentService.js
│   │
│   ├── context/              # React context providers
│   │   ├── AuthContext.jsx   # Admin authentication
│   │   ├── ModeratorContext.jsx
│   │   └── ToastContext.jsx
│   │
│   ├── utils/                # Utility functions
│   │   ├── dateUtils.js
│   │   ├── timeUtils.js
│   │   ├── validators.js
│   │   └── constants.js
│   │
│   ├── App.jsx               # Root component with routing
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
│
├── public/
│   └── favicon.ico
├── index.html
├── vite.config.js
├── package.json
├── Dockerfile
└── nginx.conf
```

## Routing Structure

```jsx
// App.jsx routes
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<Landing />} />
  <Route path="/register" element={<Register />} />
  <Route path="/availability/:moderatorId" element={<Availability />} />

  {/* Admin Routes */}
  <Route path="/admin/login" element={<AdminLogin />} />
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="days" element={<EventDays />} />
    <Route path="rooms" element={<Rooms />} />
    <Route path="sessions" element={<Sessions />} />
    <Route path="moderators" element={<Moderators />} />
    <Route path="assignments" element={<Assignments />} />
  </Route>

  {/* Moderator Portal Routes */}
  <Route path="/portal" element={<ModeratorLayout />}>
    <Route index element={<Schedule />} />
    <Route path="availability" element={<Settings />} />
  </Route>

  {/* Moderator Lookup/Login */}
  <Route path="/lookup" element={<ModeratorLookup />} />
</Routes>
```

## Key Pages

### Public Pages

#### Landing Page (`/`)
- Welcome message
- Link to register as moderator
- Admin login link

#### Register Page (`/register`)
- Form: Name, Email, Phone
- On submit: Creates moderator, redirects to availability page

#### Availability Page (`/availability/:moderatorId`)
- Shows all event days
- For each day, shows operating hours
- User can add multiple time ranges per day
- Visual timeline showing selected availability
- Submit button saves all availability

### Admin Pages

#### Dashboard (`/admin`)
- Summary cards: Total moderators, sessions, assignments
- Unassigned sessions count
- Quick actions: Run auto-assign, view reports
- Recent activity

#### Event Days (`/admin/days`)
- List of event days
- Add new day form (date, start time, end time)
- Edit/delete days
- Shows session count per day

#### Rooms (`/admin/rooms`)
- List of rooms
- Add/edit/delete rooms
- Shows session count per room

#### Sessions (`/admin/sessions`)
- Filterable table: by day, room, assignment status
- Add session form
- Bulk import option
- For each session: name, time, room, moderators needed, assigned moderators
- Edit/delete actions

#### Moderators (`/admin/moderators`)
- Table of all registered moderators
- Shows: name, email, phone, availability hours, assignment count
- Click to view details (availability, assignments)
- Delete action

#### Assignments (`/admin/assignments`)
- Visual grid view: Days x Sessions x Moderators
- "Auto-Assign" button with options
- Manual drag-and-drop assignment
- Clear assignments button
- Export to CSV/PDF

### Moderator Portal

The moderator portal uses a sidebar layout with two main tabs.

#### Schedule (`/portal`)
- List of assigned sessions grouped by date
- Each session shows: name, time (12-hour format), room
- Headcount update inline:
  - Choose between "% Full" (percentage) or "Exact Count"
  - Shows room capacity when available
  - Real-time calculation of estimated headcount from percentage
  - Percentage values saved separately to indicate estimate
- Sessions sorted by start time within each day

#### Availability Settings (`/portal/availability`)
- All event days displayed as cards
- For each day:
  - "All Day" button to set full availability
  - "Clear" button to remove all slots
  - Add multiple time slots with 12-hour AM/PM format
  - Time dropdown limited to day's operating hours (30-min intervals)
- Schedule preference selector:
  - Back-to-back (consecutive sessions)
  - Spread out (breaks between)
  - Flexible (no preference)
- Save button appears only when changes are made
- Individual slot delete with confirmation
- Immediate persist on delete (no save needed)

#### Moderator Lookup (`/lookup`)
- Email lookup to access portal
- Stores moderator in localStorage for persistence
- No password required (email-based access)

## State Management

Using React Context for global state:

### AuthContext
```jsx
const AuthContext = {
  admin: { id, email, name } | null,
  token: string | null,
  login: (email, password) => Promise,
  logout: () => void,
  isAuthenticated: boolean
}
```

### ModeratorContext
```jsx
const ModeratorContext = {
  moderator: { id, name, email } | null,
  token: string | null,
  setModerator: (data) => void,
  clearModerator: () => void
}
```

## API Service Pattern

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

```javascript
// services/sessionService.js
import api from './api';

export const sessionService = {
  getAll: (filters) => api.get('/sessions', { params: filters }),
  getById: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  update: (id, data) => api.put(`/sessions/${id}`, data),
  updateHeadcount: (id, headcount) => api.patch(`/sessions/${id}/headcount`, { headcount }),
  delete: (id) => api.delete(`/sessions/${id}`),
  bulkCreate: (sessions) => api.post('/sessions/bulk', { sessions })
};
```

## Custom Hooks

### useApi
```javascript
// hooks/useApi.js
import { useState, useCallback } from 'react';

export function useApi(apiFunc) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFunc(...args);
      setData(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.error || { message: 'An error occurred' });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunc]);

  return { data, loading, error, execute };
}
```

## Environment Variables

```env
VITE_API_URL=http://localhost:3001
```

Access in code:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Build & Deployment

### Development
```bash
npm run dev
# Runs on http://localhost:3000
```

### Production Build
```bash
npm run build
# Outputs to dist/
```

### Docker
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

### nginx.conf
```nginx
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```
