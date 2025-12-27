import { success, validationError } from '../utils/responses.js';

const GOOGLE_SHEET_ID = '1x_z60Kv7pomIGq2vO-Bmr2lX0d3TOxg_G8Rwvt1CtJI';
const SHEET_GIDS = {
  friday: '0',
  saturday: '85377331',
  sunday: '1134aborede'  // Will need to find actual GID
};

// Day mapping - GIDs from Google Sheet tabs
// To find GIDs: Open sheet, click on tab, look at URL for gid=XXXXX
const DATE_TO_GID = {
  '2025-12-26': '0',           // Friday
  '2025-12-27': '85377331',    // Saturday
  '2025-12-28': '1550aborede'  // Sunday - UPDATE THIS with actual GID from sheet URL
};

export default async function syncRoutes(fastify, options) {
  const { db } = fastify;

  // Fetch CSV from Google Sheets
  async function fetchSheetCSV(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }
    return await response.text();
  }

  // Parse CSV to array
  function parseCSV(csv) {
    const lines = csv.split('\n');
    const result = [];
    let currentRow = [];
    let inQuotes = false;
    let currentField = '';

    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }

      if (!inQuotes) {
        currentRow.push(currentField.trim());
        result.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += '\n';
      }
    }

    if (currentRow.length > 0 || currentField) {
      currentRow.push(currentField.trim());
      result.push(currentRow);
    }

    return result;
  }

  // Extract room name from column header like "MSA National (Level 1 - S101)"
  function extractRoomFromHeader(header) {
    if (!header) return null;
    // Look for pattern like (Level X - XXXX) or (Hyatt...)
    const match = header.match(/\(([^)]+)\)\s*$/);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  // Parse time range like "10:30AM - 11:15AM" to start and end times
  function parseTimeRange(timeStr) {
    if (!timeStr) return null;

    // Match patterns like "10:30AM - 11:15AM" or "10:30 AM - 11:15 AM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    const [, startH, startM, startAP, endH, endM, endAP] = match;

    let startHour = parseInt(startH);
    let endHour = parseInt(endH);

    if (startAP.toUpperCase() === 'PM' && startHour !== 12) startHour += 12;
    if (startAP.toUpperCase() === 'AM' && startHour === 12) startHour = 0;
    if (endAP.toUpperCase() === 'PM' && endHour !== 12) endHour += 12;
    if (endAP.toUpperCase() === 'AM' && endHour === 12) endHour = 0;

    return {
      start_time: `${String(startHour).padStart(2, '0')}:${startM}`,
      end_time: `${String(endHour).padStart(2, '0')}:${endM}`
    };
  }

  // Check if a cell contains a real session (has speaker names, not just org/sponsor)
  function isRealSession(cellContent) {
    if (!cellContent || cellContent.trim() === '') return false;

    const lower = cellContent.toLowerCase();

    // Skip common non-session content
    const skipPatterns = [
      'break', 'lunch', 'dinner', 'prayer', 'registration', 'check-in',
      'networking', 'exhibition', 'expo', 'booth', 'sponsor',
      'opening', 'closing', 'ceremony', 'tbd', 'to be determined',
      'reserved', 'setup', 'teardown', 'doors open'
    ];

    for (const pattern of skipPatterns) {
      if (lower.includes(pattern)) return false;
    }

    // Check if it looks like it has a person's name (contains letters and possibly title)
    // Real sessions usually have format: "Session Title - Speaker Name" or "Speaker Name: Topic"
    // Or just multi-word content that's not just an organization

    // If it's very short (less than 5 chars), probably not a real session
    if (cellContent.trim().length < 5) return false;

    return true;
  }

  // Extract session name and speaker from cell content
  function parseSessionCell(cellContent) {
    if (!cellContent) return null;

    const content = cellContent.trim();

    // Try to split by common delimiters
    // Pattern 1: "Session Title - Speaker Name"
    // Pattern 2: "Speaker Name: Session Title"
    // Pattern 3: "Session Title\nSpeaker Name"

    let sessionName = content;
    let speaker = null;

    // Check for newline separator
    if (content.includes('\n')) {
      const parts = content.split('\n').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2) {
        sessionName = parts[0];
        speaker = parts.slice(1).join(', ');
      }
    }
    // Check for " - " separator (but not at start/end)
    else if (content.includes(' - ') && !content.startsWith(' - ')) {
      const idx = content.lastIndexOf(' - ');
      if (idx > 0 && idx < content.length - 3) {
        sessionName = content.substring(0, idx).trim();
        speaker = content.substring(idx + 3).trim();
      }
    }
    // Check for " by " separator
    else if (content.toLowerCase().includes(' by ')) {
      const idx = content.toLowerCase().lastIndexOf(' by ');
      sessionName = content.substring(0, idx).trim();
      speaker = content.substring(idx + 4).trim();
    }

    return { sessionName, speaker };
  }

  // Parse a single sheet into sessions
  function parseSheet(csvData, date) {
    const rows = parseCSV(csvData);
    if (rows.length < 2) return [];

    const sessions = [];
    const headers = rows[0];

    // Extract room names from headers (skip first column which is TIME)
    const rooms = headers.slice(1).map(h => ({
      original: h,
      room: extractRoomFromHeader(h)
    }));

    // Process each row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const timeStr = row[0];
      const times = parseTimeRange(timeStr);

      if (!times) continue;

      // Process each cell in the row
      for (let j = 1; j < row.length && j <= rooms.length; j++) {
        const cellContent = row[j];

        if (!isRealSession(cellContent)) continue;

        const parsed = parseSessionCell(cellContent);
        if (!parsed) continue;

        sessions.push({
          date,
          start_time: times.start_time,
          end_time: times.end_time,
          room: rooms[j - 1].room,
          room_header: rooms[j - 1].original,
          session_name: parsed.sessionName,
          speaker: parsed.speaker,
          raw_content: cellContent
        });
      }
    }

    return sessions;
  }

  // Find matching session in database
  async function findMatchingSession(sheetSession) {
    // Strategy 1: Match by room + time + date
    const roomMatch = await db.query(`
      SELECT s.*, r.name as room_name
      FROM sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN event_days ed ON s.event_day_id = ed.id
      WHERE ed.date = $1
        AND s.start_time = $2
        AND r.name ILIKE $3
    `, [sheetSession.date, sheetSession.start_time, `%${sheetSession.room}%`]);

    if (roomMatch.rows.length === 1) {
      return { match: roomMatch.rows[0], matchType: 'room_time' };
    }

    // Strategy 2: Match by session name similarity
    const nameMatch = await db.query(`
      SELECT s.*, r.name as room_name, ed.date
      FROM sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN event_days ed ON s.event_day_id = ed.id
      WHERE ed.date = $1
        AND (
          s.name ILIKE $2
          OR s.name ILIKE $3
        )
    `, [
      sheetSession.date,
      `%${sheetSession.session_name.substring(0, 30)}%`,
      `%${sheetSession.session_name.split(' ').slice(0, 3).join(' ')}%`
    ]);

    if (nameMatch.rows.length === 1) {
      return { match: nameMatch.rows[0], matchType: 'name' };
    }

    if (nameMatch.rows.length > 1) {
      return { match: null, matchType: 'multiple', candidates: nameMatch.rows };
    }

    return { match: null, matchType: 'none' };
  }

  // GET /api/sync/preview - Preview sync changes
  fastify.get('/preview', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const logs = [];
    const changes = [];
    const errors = [];

    try {
      // Get event days from database
      const daysResult = await db.query('SELECT id, date FROM event_days ORDER BY date');
      const eventDays = daysResult.rows;

      logs.push({ type: 'info', message: `Found ${eventDays.length} event days in database` });

      // Fetch and parse each day's sheet
      const allSheetSessions = [];

      for (const day of eventDays) {
        const dateStr = day.date.toISOString().split('T')[0];
        const gid = DATE_TO_GID[dateStr];

        if (!gid) {
          logs.push({ type: 'warning', message: `No sheet GID configured for ${dateStr}` });
          continue;
        }

        try {
          logs.push({ type: 'info', message: `Fetching sheet for ${dateStr} (gid=${gid})` });
          const csv = await fetchSheetCSV(gid);
          const sessions = parseSheet(csv, dateStr);
          logs.push({ type: 'success', message: `Parsed ${sessions.length} sessions from ${dateStr} sheet` });
          allSheetSessions.push(...sessions);
        } catch (err) {
          errors.push({ date: dateStr, error: err.message });
          logs.push({ type: 'error', message: `Failed to fetch ${dateStr}: ${err.message}` });
        }
      }

      logs.push({ type: 'info', message: `Total sessions from sheets: ${allSheetSessions.length}` });

      // Match each sheet session to database
      for (const sheetSession of allSheetSessions) {
        const result = await findMatchingSession(sheetSession);

        if (result.match) {
          const dbSession = result.match;
          const sessionChanges = [];

          // Check if speaker needs update
          if (sheetSession.speaker && sheetSession.speaker !== dbSession.speaker) {
            sessionChanges.push({
              field: 'speaker',
              old: dbSession.speaker,
              new: sheetSession.speaker
            });
          }

          if (sessionChanges.length > 0) {
            changes.push({
              action: 'update',
              matchType: result.matchType,
              dbSession: {
                id: dbSession.id,
                name: dbSession.name,
                speaker: dbSession.speaker,
                room: dbSession.room_name,
                time: `${dbSession.start_time} - ${dbSession.end_time}`
              },
              sheetSession: {
                name: sheetSession.session_name,
                speaker: sheetSession.speaker,
                room: sheetSession.room,
                time: `${sheetSession.start_time} - ${sheetSession.end_time}`
              },
              changes: sessionChanges
            });
          }
        } else if (result.matchType === 'multiple') {
          logs.push({
            type: 'warning',
            message: `Multiple matches for "${sheetSession.session_name}" - skipping`,
            candidates: result.candidates?.map(c => c.name)
          });
        } else {
          logs.push({
            type: 'info',
            message: `No match found for: "${sheetSession.session_name}" at ${sheetSession.start_time} in ${sheetSession.room}`
          });
        }
      }

      return success({
        summary: {
          totalSheetSessions: allSheetSessions.length,
          changesFound: changes.length,
          errors: errors.length
        },
        changes,
        logs,
        errors
      });

    } catch (err) {
      fastify.log.error('Sync preview error:', err);
      throw err;
    }
  });

  // POST /api/sync/apply - Apply sync changes
  fastify.post('/apply', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { changes } = request.body;

    if (!changes || !Array.isArray(changes)) {
      throw validationError('Changes array is required');
    }

    const results = [];
    const syncLog = [];

    for (const change of changes) {
      if (change.action === 'update' && change.dbSession?.id) {
        try {
          // Build update query based on changes
          for (const fieldChange of change.changes) {
            if (fieldChange.field === 'speaker') {
              await db.query(
                'UPDATE sessions SET speaker = $1 WHERE id = $2',
                [fieldChange.new, change.dbSession.id]
              );

              syncLog.push({
                timestamp: new Date().toISOString(),
                sessionId: change.dbSession.id,
                sessionName: change.dbSession.name,
                field: 'speaker',
                oldValue: fieldChange.old,
                newValue: fieldChange.new,
                status: 'success'
              });

              results.push({
                sessionId: change.dbSession.id,
                status: 'updated',
                field: 'speaker'
              });
            }
          }
        } catch (err) {
          syncLog.push({
            timestamp: new Date().toISOString(),
            sessionId: change.dbSession.id,
            sessionName: change.dbSession.name,
            error: err.message,
            status: 'failed'
          });

          results.push({
            sessionId: change.dbSession.id,
            status: 'failed',
            error: err.message
          });
        }
      }
    }

    // Store sync log in database
    try {
      await db.query(`
        INSERT INTO sync_logs (sync_type, sync_data, created_at)
        VALUES ($1, $2, NOW())
      `, ['google_sheet', JSON.stringify(syncLog)]);
    } catch (err) {
      // Table might not exist yet, log but don't fail
      fastify.log.warn('Could not save sync log:', err.message);
    }

    return success({
      applied: results.filter(r => r.status === 'updated').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
      log: syncLog
    });
  });

  // GET /api/sync/logs - Get sync history
  fastify.get('/logs', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const result = await db.query(`
        SELECT * FROM sync_logs
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return success(result.rows);
    } catch (err) {
      // Table might not exist
      return success([]);
    }
  });
}
