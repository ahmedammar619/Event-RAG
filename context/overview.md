# Project Overview

## What is the Moderation System?

The Moderation System is a web platform designed for the MASCOM Annual Event in Chicago. It solves the challenge of coordinating volunteer moderators across multiple event sessions with automated scheduling and assignment.

## The Problem

Organizing an event with multiple sessions requires:
- Tracking which volunteers are available and when
- Assigning moderators to sessions fairly
- Ensuring all sessions have adequate coverage
- Managing last-minute changes and headcount tracking

Manual coordination is time-consuming and error-prone.

## The Solution

This platform automates the entire process:

1. **Admin configures the event** - Sets up days, hours, rooms, and sessions
2. **Volunteers register** - Enter their info and availability per day
3. **Auto-assignment** - One click assigns moderators optimally
4. **Event operations** - Moderators track headcount during the event

## Key Users

### Admin
- Event organizers who set up the system
- Can view all data, manage sessions, run auto-assignment
- Has full control over the platform

### Moderators (Volunteers)
- Register via a shared link
- Input their availability for each event day
- View their assigned sessions
- Update headcount after moderating

## Core Concepts

### Event Days
The dates when the event takes place. Each day has:
- A date (e.g., March 15, 2025)
- Operating hours (e.g., 9:00 AM - 6:00 PM) - this is the "threshold"

### Sessions
Individual talks, workshops, or activities. Each session has:
- Name (e.g., "Opening Keynote")
- Day (which event day)
- Room/Location (e.g., "Hall A")
- Time slot (start and end time)
- Moderators needed (how many volunteers required)
- Headcount (actual attendance, filled in later)

### Availability
Volunteers specify when they can work:
- Per day, they enter time ranges
- Can have multiple ranges (e.g., 9am-12pm AND 2pm-5pm)
- Must be within the day's operating hours

### Assignments
The system assigns moderators to sessions:
- Auto-assignment uses an algorithm for optimal distribution
- Manual overrides are possible
- Tracks who assigned (auto vs manual)

## Project Goals

1. **Simple volunteer experience** - Easy registration and availability input
2. **Fair distribution** - Balance workload across moderators
3. **Real-time visibility** - Admin sees all assignments at a glance
4. **Flexibility** - Support manual overrides and changes
5. **Event-day support** - Headcount tracking during the event

## Success Metrics

- All sessions have assigned moderators
- Moderator workload is balanced
- Headcount data is captured for future planning
- Minimal manual intervention needed
