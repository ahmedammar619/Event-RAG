# Auto-Assignment Algorithm

## Overview

The auto-assignment algorithm matches available moderators to sessions that need coverage. The goal is to:

1. Ensure all sessions have the required number of moderators
2. Distribute workload fairly across all moderators
3. Avoid assigning moderators to overlapping sessions
4. Maximize overall coverage

## Algorithm Design

### Input
- List of sessions (with moderators_needed)
- List of moderators with their availability slots
- Existing assignments (if not clearing)

### Output
- New assignments linking moderators to sessions
- Report of unassigned sessions (if any)

### Constraints
1. **Time Match**: Moderator's availability must fully cover the session time
2. **No Overlap**: Moderator cannot be assigned to overlapping sessions
3. **Capacity**: Each session has a `moderators_needed` limit
4. **Fairness**: Balance assignments across moderators

## Algorithm Steps

```
1. PREPARE
   - Get all sessions ordered by start time
   - Get all moderators with availability
   - Initialize assignment counts to 0 (or existing counts)

2. FOR EACH session (in chronological order):
   a. Find all moderators available during session time
   b. Filter out moderators already assigned to overlapping sessions
   c. Score remaining moderators (see Scoring below)
   d. Sort by score (descending)
   e. Assign top N moderators (where N = moderators_needed - current_assignments)
   f. Update moderator assignment counts

3. REPORT
   - Count sessions with full coverage
   - List sessions with partial/no coverage
   - Return statistics
```

## Scoring System

Each eligible moderator receives a score based on:

| Factor | Weight | Logic |
|--------|--------|-------|
| Assignment Count | 40% | Fewer assignments = higher score |
| Total Availability | 30% | More total hours = higher score |
| Availability Fit | 20% | Closer fit to session = higher score |
| Random Tiebreaker | 10% | Prevents predictable bias |

### Scoring Formula

```javascript
function calculateScore(moderator, session, existingAssignments) {
  // Factor 1: Assignment balance (fewer = better)
  // Scale: 0-100 where 0 assignments = 100, 10+ assignments = 0
  const assignmentScore = Math.max(0, 100 - (existingAssignments * 10));

  // Factor 2: Total availability (more = better)
  // Scale: 0-100 where 12+ hours = 100
  const totalHours = calculateTotalAvailabilityHours(moderator);
  const availabilityScore = Math.min(100, (totalHours / 12) * 100);

  // Factor 3: Fit score (tighter fit = better utilization)
  // If availability barely covers session, score higher
  const slotDuration = getAvailabilitySlotDuration(moderator, session);
  const sessionDuration = getSessionDuration(session);
  const fitRatio = sessionDuration / slotDuration;
  const fitScore = fitRatio * 100; // 1.0 = perfect fit = 100

  // Factor 4: Random tiebreaker
  const randomScore = Math.random() * 100;

  // Weighted combination
  const finalScore =
    (assignmentScore * 0.4) +
    (availabilityScore * 0.3) +
    (fitScore * 0.2) +
    (randomScore * 0.1);

  return finalScore;
}
```

## Implementation

```javascript
// services/assignmentService.js

export async function autoAssign(pg, options = {}) {
  const { clearExisting = false, dayId = null } = options;

  // Clear existing if requested
  if (clearExisting) {
    if (dayId) {
      await pg.query(`
        DELETE FROM assignments
        WHERE session_id IN (SELECT id FROM sessions WHERE event_day_id = $1)
      `, [dayId]);
    } else {
      await pg.query('DELETE FROM assignments');
    }
  }

  // Get sessions to assign
  let sessionQuery = `
    SELECT s.*, ed.date,
      (SELECT COUNT(*) FROM assignments a WHERE a.session_id = s.id) as current_assignments
    FROM sessions s
    JOIN event_days ed ON s.event_day_id = ed.id
  `;
  const sessionParams = [];

  if (dayId) {
    sessionQuery += ' WHERE s.event_day_id = $1';
    sessionParams.push(dayId);
  }

  sessionQuery += ' ORDER BY ed.date, s.start_time';

  const sessions = (await pg.query(sessionQuery, sessionParams)).rows;

  // Get all moderators with their availability
  const moderators = await getModeratorsWithAvailability(pg);

  // Track assignments made in this run
  const assignmentCounts = {};
  moderators.forEach(m => {
    assignmentCounts[m.id] = m.existing_assignments || 0;
  });

  const results = {
    total_sessions: sessions.length,
    sessions_assigned: 0,
    sessions_unassigned: 0,
    total_assignments_created: 0,
    unassigned_sessions: []
  };

  // Process each session
  for (const session of sessions) {
    const needed = session.moderators_needed - session.current_assignments;

    if (needed <= 0) {
      results.sessions_assigned++;
      continue;
    }

    // Find available moderators
    const available = await findAvailableModerators(
      pg,
      session.event_day_id,
      session.start_time,
      session.end_time,
      session.id
    );

    if (available.length === 0) {
      results.sessions_unassigned++;
      results.unassigned_sessions.push({
        id: session.id,
        name: session.name,
        reason: 'No available moderators'
      });
      continue;
    }

    // Score and sort moderators
    const scored = available.map(mod => ({
      moderator: mod,
      score: calculateScore(mod, session, assignmentCounts[mod.id] || 0)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Assign top N
    const toAssign = scored.slice(0, needed);

    for (const { moderator } of toAssign) {
      await pg.query(`
        INSERT INTO assignments (session_id, moderator_id, assigned_by)
        VALUES ($1, $2, 'auto')
      `, [session.id, moderator.id]);

      assignmentCounts[moderator.id] = (assignmentCounts[moderator.id] || 0) + 1;
      results.total_assignments_created++;
    }

    if (toAssign.length >= needed) {
      results.sessions_assigned++;
    } else {
      results.sessions_unassigned++;
      results.unassigned_sessions.push({
        id: session.id,
        name: session.name,
        reason: `Only ${toAssign.length} of ${needed} moderators available`
      });
    }
  }

  return results;
}

async function findAvailableModerators(pg, eventDayId, startTime, endTime, sessionId) {
  const result = await pg.query(`
    SELECT DISTINCT m.*,
      (SELECT COUNT(*) FROM assignments WHERE moderator_id = m.id) as existing_assignments
    FROM moderators m
    JOIN availability a ON m.id = a.moderator_id
    WHERE a.event_day_id = $1
      AND a.start_time <= $2
      AND a.end_time >= $3
      AND m.id NOT IN (
        -- Exclude moderators with overlapping assignments
        SELECT ass.moderator_id
        FROM assignments ass
        JOIN sessions s ON ass.session_id = s.id
        WHERE s.event_day_id = $1
          AND s.start_time < $3
          AND s.end_time > $2
      )
      AND m.id NOT IN (
        -- Exclude already assigned to this session
        SELECT moderator_id FROM assignments WHERE session_id = $4
      )
  `, [eventDayId, startTime, endTime, sessionId]);

  return result.rows;
}
```

## Edge Cases

### 1. No Available Moderators
- Session is flagged as unassigned
- Included in the unassigned report

### 2. Fewer Moderators Than Needed
- Assign as many as available
- Flag session as partially covered

### 3. Overlapping Sessions
- Same moderator can only be in one place
- Sessions processed chronologically
- Earlier sessions get priority

### 4. Multiple Availability Slots
- Moderator available 9-12 AND 2-5
- Session at 10-11 uses the 9-12 slot
- Session at 3-4 uses the 2-5 slot

### 5. Exactly Matching Times
- Session 9:00-10:00, Availability 9:00-10:00
- This is valid (availability covers session)

## API Endpoint

```javascript
// POST /api/assignments/auto
fastify.post('/auto', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const { clear_existing = false, day_id = null } = request.body;

  const results = await autoAssign(fastify.pg, {
    clearExisting: clear_existing,
    dayId: day_id
  });

  return { success: true, data: results };
});
```

## Response Example

```json
{
  "success": true,
  "data": {
    "total_sessions": 40,
    "sessions_assigned": 38,
    "sessions_unassigned": 2,
    "total_assignments_created": 45,
    "unassigned_sessions": [
      {
        "id": 15,
        "name": "Late Night Session",
        "reason": "No available moderators"
      },
      {
        "id": 28,
        "name": "Early Morning Workshop",
        "reason": "Only 1 of 2 moderators available"
      }
    ]
  }
}
```

## Manual Override

After auto-assignment, admins can:

1. **Add assignment**: Manually assign a moderator to a session
2. **Remove assignment**: Unassign a moderator
3. **Swap**: Remove one, add another

The system validates manual assignments:
- Warns if moderator isn't available during session
- Warns if session already has enough moderators
- Prevents duplicate assignments

## Future Improvements

1. **Skill Matching**: Add moderator skills, match to session requirements
2. **Preferences**: Let moderators indicate session preferences
3. **Break Times**: Ensure moderators get breaks between sessions
4. **Room Proximity**: Consider room locations for back-to-back assignments
5. **Historical Balance**: Consider past event assignments for long-term fairness
