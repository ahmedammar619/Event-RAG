# User Flows

## Overview

This document details the step-by-step user journeys for all actors in the system.

---

## Flow 1: Admin Initial Setup

The admin configures the event before volunteers can register.

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN INITIAL SETUP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Login ──► 2. Create Days ──► 3. Create Rooms ──► 4. Create  │
│               (with hours)        (locations)         Sessions  │
│                                                                  │
│                          5. Share Registration Link              │
│                                      │                           │
│                                      ▼                           │
│                              [Volunteers Register]               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Admin Login

**Page**: `/admin/login`

1. Admin navigates to admin login page
2. Enters email and password
3. System validates credentials
4. On success: Redirects to dashboard
5. On failure: Shows error message

**API Call**: `POST /api/admin/login`

### Step 2: Create Event Days

**Page**: `/admin/days`

1. Admin clicks "Add Day"
2. Fills form:
   - Date (calendar picker)
   - Start Time (e.g., 09:00)
   - End Time (e.g., 18:00)
3. Clicks "Save"
4. Day appears in list
5. Repeat for each event day

**API Call**: `POST /api/days`

**Example**:
```
Day 1: March 15, 2025 | 09:00 - 18:00
Day 2: March 16, 2025 | 09:00 - 17:00
Day 3: March 17, 2025 | 10:00 - 15:00
```

### Step 3: Create Rooms

**Page**: `/admin/rooms`

1. Admin clicks "Add Room"
2. Fills form:
   - Name (e.g., "Hall A")
   - Capacity (optional)
3. Clicks "Save"
4. Room appears in list

**API Call**: `POST /api/rooms`

### Step 4: Create Sessions

**Page**: `/admin/sessions`

1. Admin clicks "Add Session"
2. Fills form:
   - Name (e.g., "Opening Keynote")
   - Day (dropdown of created days)
   - Room (dropdown of created rooms)
   - Start Time (must be within day's hours)
   - End Time (must be within day's hours)
   - Moderators Needed (default: 1)
3. Clicks "Save"
4. Session appears in list

**API Call**: `POST /api/sessions`

**Bulk Import Option**:
- Admin can upload CSV with sessions
- System validates and creates all at once

### Step 5: Share Registration Link

1. Admin copies the registration URL: `https://app.com/register`
2. Shares via email, WhatsApp, or event communication channels
3. Message example:
   > "Assalamu Alaikum! Please register as a volunteer moderator for MASCON 2025 at: [link]. You'll be asked to provide your availability."

---

## Flow 2: Moderator Registration

Volunteers register and submit their availability.

```
┌─────────────────────────────────────────────────────────────────┐
│                   MODERATOR REGISTRATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Open Link ──► 2. Enter Info ──► 3. Select Availability ──►  │
│                   (name, email,      (for each day)              │
│                    phone)                                        │
│                                                                  │
│                          4. Submit ──► 5. Confirmation           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Open Registration Link

**Page**: `/register`

1. Volunteer opens the shared link
2. Sees welcome message and event info
3. Sees registration form

### Step 2: Enter Personal Information

**Form Fields**:
- Full Name (required)
- Email (required, validated)
- Phone Number (required)

### Step 3: Select Availability

**Page**: `/register` or `/availability/:id` (after initial registration)

For each event day:

1. System shows the day with operating hours
   - Example: "Saturday, March 15 (9:00 AM - 6:00 PM)"

2. Volunteer adds availability slots:
   - Click "Add Time Slot"
   - Select start time (dropdown, 15-min increments)
   - Select end time (dropdown, 15-min increments)
   - Can add multiple slots per day

3. Visual timeline shows selected slots

**UI Example**:
```
Saturday, March 15 (9:00 AM - 6:00 PM)
├─ Slot 1: 9:00 AM - 12:00 PM  [Remove]
├─ Slot 2: 2:00 PM - 5:00 PM   [Remove]
└─ [+ Add Time Slot]

Sunday, March 16 (9:00 AM - 5:00 PM)
├─ Slot 1: 9:00 AM - 5:00 PM   [Remove]  (All day!)
└─ [+ Add Time Slot]
```

### Step 4: Submit

1. Volunteer reviews their info and availability
2. Clicks "Submit Registration"
3. System saves moderator and availability

**API Calls**:
- `POST /api/moderators/register`
- `POST /api/availability/bulk`

### Step 5: Confirmation

1. Success message displayed
2. Shows summary of registration
3. Provides link to view/edit availability later
4. Optional: Email confirmation sent

**Message**:
> "JazakAllah Khair! You're registered as a volunteer. You'll be notified when sessions are assigned to you."

---

## Flow 3: Admin Runs Auto-Assignment

After volunteers register, admin assigns moderators to sessions.

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTO-ASSIGNMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Review ──► 2. Click Auto-Assign ──► 3. Review Results ──►   │
│  Registrations                                                   │
│                                                                  │
│                          4. Manual Adjustments (if needed)       │
│                                      │                           │
│                                      ▼                           │
│                          5. Notify Moderators                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Review Registrations

**Page**: `/admin/moderators`

1. Admin sees list of all registered moderators
2. For each: name, email, phone, total availability hours
3. Can click to see detailed availability
4. Verifies enough moderators are registered

### Step 2: Run Auto-Assignment

**Page**: `/admin/assignments`

1. Admin clicks "Auto-Assign" button
2. Modal appears with options:
   - [ ] Clear existing assignments
   - [ ] Assign for specific day only (dropdown)
3. Admin clicks "Run"
4. Loading indicator while algorithm runs

**API Call**: `POST /api/assignments/auto`

### Step 3: Review Results

**Results Modal**:
```
Assignment Complete!

✓ 38 of 40 sessions fully assigned
✗ 2 sessions need attention

Sessions Needing Attention:
- Late Night Session (No available moderators)
- Early Morning Workshop (1 of 2 moderators assigned)

Total Assignments Created: 45
```

### Step 4: Manual Adjustments

**Page**: `/admin/assignments`

1. Admin reviews assignment grid/table
2. For unassigned sessions:
   - View available moderators
   - Manually assign someone (even if outside availability)
   - Or mark session as "needs volunteer"
3. Can swap moderators between sessions
4. Can remove assignments

**API Calls**:
- `POST /api/assignments/manual`
- `DELETE /api/assignments/:id`

### Step 5: Notify Moderators

Options:
1. **In-App**: Moderators see assignments when they log in
2. **Email**: System sends email with assigned sessions (future feature)
3. **Manual**: Admin exports list, sends via WhatsApp/email

---

## Flow 4: Moderator Views Assignments

Moderators check their assigned sessions.

```
┌─────────────────────────────────────────────────────────────────┐
│                   VIEW ASSIGNMENTS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Open Link ──► 2. Enter Email ──► 3. View Assignments        │
│  (or bookmark)                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Access Portal

**Page**: `/my/assignments`

1. Moderator opens their portal link
2. Or navigates from main site

### Step 2: Identify

Options:
- Enter email to look up assignments
- Or use token from registration (stored in browser)

### Step 3: View Assignments

**Page shows**:
```
Your Assignments

Saturday, March 15, 2025
├─ 9:00 AM - 10:30 AM | Opening Keynote | Hall A
├─ 11:00 AM - 12:00 PM | Workshop A | Room 101
└─ 2:00 PM - 3:30 PM | Panel Discussion | Hall B

Sunday, March 16, 2025
└─ 10:00 AM - 11:30 AM | Closing Session | Hall A

[Download Schedule]
```

---

## Flow 5: Moderator Updates Headcount

During/after sessions, moderators record attendance.

```
┌─────────────────────────────────────────────────────────────────┐
│                   UPDATE HEADCOUNT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. View Assignments ──► 2. Select Session ──► 3. Enter Count   │
│                                                    ──► 4. Save   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1-2: Navigate to Session

From assignments page, moderator clicks on a session.

### Step 3: Enter Headcount

**Page**: `/my/headcount/:sessionId`

```
Opening Keynote
Hall A | 9:00 AM - 10:30 AM

Headcount: [____150____]

[Save]
```

### Step 4: Save

1. Moderator enters the count
2. Clicks "Save"
3. Confirmation shown
4. Returns to assignments list

**API Call**: `PATCH /api/sessions/:id/headcount`

---

## Flow 6: Admin Views Reports

Admin monitors event progress and reviews data.

```
┌─────────────────────────────────────────────────────────────────┐
│                      VIEW REPORTS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Dashboard shows:                                                │
│  - Total registrations                                           │
│  - Assignment coverage                                           │
│  - Headcount data (during/after event)                          │
│  - Export options                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Dashboard Metrics

**Page**: `/admin`

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Moderators  │  Sessions   │  Assigned   │  Headcount  │
│     25      │     40      │   38/40     │    1,250    │
└─────────────┴─────────────┴─────────────┴─────────────┘

Today's Sessions:
- Opening Keynote (9:00 AM) - Hall A - 2 moderators - 150 attendees
- Workshop A (11:00 AM) - Room 101 - 1 moderator - [pending]
...
```

### Export Options

- **Assignments CSV**: All session-moderator assignments
- **Headcount Report**: Sessions with attendance numbers
- **Moderator Summary**: Hours contributed per volunteer

---

## Error States & Edge Cases

### Registration Errors

| Error | User Message | Resolution |
|-------|--------------|------------|
| Duplicate email | "This email is already registered" | Link to login/view assignments |
| Invalid email | "Please enter a valid email" | Re-enter email |
| Server error | "Something went wrong. Please try again." | Retry |

### Availability Errors

| Error | User Message | Resolution |
|-------|--------------|------------|
| Time outside hours | "Selected time must be within 9AM-6PM" | Adjust time |
| End before start | "End time must be after start time" | Adjust times |
| Overlapping slots | "This overlaps with another slot" | Remove overlap |

### Assignment Errors

| Error | Admin Message | Resolution |
|-------|---------------|------------|
| No availability | "Moderator not available during this session" | Assign anyway (with warning) |
| Already assigned | "Moderator already assigned to this session" | No action needed |
| Overlapping session | "Moderator has overlapping assignment" | Choose different moderator |

---

## Mobile Considerations

All flows should work on mobile devices:

1. **Registration**: Mobile-first form design
2. **Availability**: Touch-friendly time pickers
3. **View Assignments**: Card-based layout
4. **Update Headcount**: Large input field, big save button

---

## Accessibility

1. All forms have proper labels
2. Error messages are screen-reader friendly
3. Color is not the only indicator of state
4. Keyboard navigation supported
5. Sufficient color contrast
