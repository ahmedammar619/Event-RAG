/**
 * Auto-assignment algorithm for matching moderators to sessions
 */

export async function autoAssign(db, options = {}) {
  const { clearExisting = false, dayId = null } = options;

  // Clear existing if requested
  if (clearExisting) {
    if (dayId) {
      await db.query(`
        DELETE FROM assignments
        WHERE session_id IN (SELECT id FROM sessions WHERE event_day_id = $1)
      `, [dayId]);
    } else {
      await db.query('DELETE FROM assignments');
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

  const sessions = (await db.query(sessionQuery, sessionParams)).rows;

  // Track assignments made in this run
  const assignmentCounts = {};

  // Get existing assignment counts
  const existingCounts = await db.query(`
    SELECT moderator_id, COUNT(*) as count
    FROM assignments
    GROUP BY moderator_id
  `);

  existingCounts.rows.forEach(row => {
    assignmentCounts[row.moderator_id] = parseInt(row.count);
  });

  const results = {
    total_sessions: sessions.length,
    sessions_assigned: 0,
    sessions_partially_assigned: 0,
    sessions_unassigned: 0,
    total_assignments_created: 0,
    unassigned_sessions: []
  };

  // Process each session
  for (const session of sessions) {
    const needed = session.moderators_needed - parseInt(session.current_assignments);

    if (needed <= 0) {
      results.sessions_assigned++;
      continue;
    }

    // Find available moderators
    const available = await findAvailableModerators(
      db,
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
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        reason: 'No available moderators'
      });
      continue;
    }

    // Score and sort moderators
    const scored = [];
    for (const mod of available) {
      const adjacentInfo = await getAdjacentAssignments(
        db, mod.id, session.event_day_id, session.start_time, session.end_time
      );
      const score = calculateScore(mod, session, assignmentCounts[mod.id] || 0, adjacentInfo);
      scored.push({ moderator: mod, score });
    }

    scored.sort((a, b) => b.score - a.score);

    // Assign top N
    const toAssign = scored.slice(0, needed);
    let assignedCount = 0;

    for (const { moderator } of toAssign) {
      try {
        await db.query(`
          INSERT INTO assignments (session_id, moderator_id, assigned_by)
          VALUES ($1, $2, 'auto')
        `, [session.id, moderator.id]);

        assignmentCounts[moderator.id] = (assignmentCounts[moderator.id] || 0) + 1;
        results.total_assignments_created++;
        assignedCount++;
      } catch (err) {
        // Skip if duplicate
        console.error(`Failed to assign moderator ${moderator.id} to session ${session.id}:`, err.message);
      }
    }

    if (assignedCount >= needed) {
      results.sessions_assigned++;
    } else if (assignedCount > 0) {
      results.sessions_partially_assigned++;
      results.unassigned_sessions.push({
        id: session.id,
        name: session.name,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        reason: `Only ${assignedCount} of ${needed} moderators available`
      });
    } else {
      results.sessions_unassigned++;
      results.unassigned_sessions.push({
        id: session.id,
        name: session.name,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        reason: 'Failed to assign moderators'
      });
    }
  }

  return results;
}

async function findAvailableModerators(db, eventDayId, startTime, endTime, sessionId) {
  const result = await db.query(`
    SELECT DISTINCT m.*,
      (SELECT COUNT(*) FROM assignments WHERE moderator_id = m.id) as existing_assignments,
      (SELECT SUM(EXTRACT(EPOCH FROM (a2.end_time - a2.start_time)) / 3600)
       FROM availability a2 WHERE a2.moderator_id = m.id) as total_availability_hours
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

// Get the closest assignment times for a moderator on a given day
async function getAdjacentAssignments(db, moderatorId, eventDayId, sessionStartTime, sessionEndTime) {
  const result = await db.query(`
    SELECT s.start_time, s.end_time
    FROM assignments a
    JOIN sessions s ON a.session_id = s.id
    WHERE a.moderator_id = $1 AND s.event_day_id = $2
    ORDER BY s.start_time
  `, [moderatorId, eventDayId]);

  const assignments = result.rows;

  let hasAdjacentBefore = false;
  let hasAdjacentAfter = false;
  let hasGap = false;

  for (const assign of assignments) {
    // Check if there's an assignment that ends when this session starts (or within 30 min)
    const assignEnd = assign.end_time;
    const assignStart = assign.start_time;

    // Adjacent before: assignment ends at or near session start
    if (assignEnd >= sessionStartTime.slice(0, 5) && assignEnd <= sessionStartTime) {
      hasAdjacentBefore = true;
    }
    // Adjacent after: assignment starts at or near session end
    if (assignStart >= sessionEndTime.slice(0, 5) && assignStart <= sessionEndTime) {
      hasAdjacentAfter = true;
    }
    // Has gap: there's an assignment on the same day but not adjacent
    if (assignEnd < sessionStartTime || assignStart > sessionEndTime) {
      hasGap = true;
    }
  }

  return { hasAdjacentBefore, hasAdjacentAfter, hasGap, assignmentCount: assignments.length };
}

function calculateScore(moderator, session, existingAssignments, adjacentInfo) {
  // Factor 1: Assignment balance (fewer = better)
  // Scale: 0-100 where 0 assignments = 100, 10+ assignments = 0
  const assignmentScore = Math.max(0, 100 - (existingAssignments * 10));

  // Factor 2: Total availability (more = better)
  // Scale: 0-100 where 12+ hours = 100
  const totalHours = parseFloat(moderator.total_availability_hours) || 0;
  const availabilityScore = Math.min(100, (totalHours / 12) * 100);

  // Factor 3: Schedule preference
  // Scale: 0-100 based on how well this assignment matches their preference
  let preferenceScore = 50; // neutral default

  const preference = moderator.schedule_preference || 'no_preference';
  const { hasAdjacentBefore, hasAdjacentAfter, hasGap, assignmentCount } = adjacentInfo;
  const hasAdjacent = hasAdjacentBefore || hasAdjacentAfter;

  if (preference === 'consecutive') {
    // Prefers back-to-back sessions
    if (assignmentCount === 0) {
      preferenceScore = 50; // First assignment, neutral
    } else if (hasAdjacent) {
      preferenceScore = 100; // Great! Adjacent to existing assignment
    } else {
      preferenceScore = 20; // Not ideal, would create a gap
    }
  } else if (preference === 'spread_out') {
    // Prefers breaks between sessions
    if (assignmentCount === 0) {
      preferenceScore = 50; // First assignment, neutral
    } else if (hasAdjacent) {
      preferenceScore = 20; // Not ideal, back-to-back
    } else {
      preferenceScore = 100; // Great! Has a gap
    }
  }
  // For 'no_preference', keep the neutral score of 50

  // Factor 4: Random tiebreaker to ensure fairness
  const randomScore = Math.random() * 100;

  // Weighted combination
  const finalScore =
    (assignmentScore * 0.4) +     // 40% weight on balance
    (availabilityScore * 0.2) +   // 20% weight on availability
    (preferenceScore * 0.25) +    // 25% weight on preference
    (randomScore * 0.15);          // 15% random for fairness

  return finalScore;
}
