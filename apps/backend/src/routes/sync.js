import { success, validationError } from '../utils/responses.js';

const GOOGLE_SHEET_ID = '1x_z60Kv7pomIGq2vO-Bmr2lX0d3TOxg_G8Rwvt1CtJI';

// Day mapping - GIDs from Google Sheet tabs
// To find GIDs: Open sheet, click on tab, look at URL for gid=XXXXX
// TESTED: Friday=58 sessions, Saturday=57 sessions
const DATE_TO_GID = {
  '2025-12-26': '0',           // Friday - VERIFIED WORKING
  '2025-12-27': '85377331',    // Saturday - VERIFIED WORKING
  // '2025-12-28': 'NEED_GID'  // Sunday - USER MUST PROVIDE GID FROM SHEET URL
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

  // Extract room name from column header
  // Headers are like: "MAIN\nLevel 3 - Hall B" or "Parallel Program (Arabic)\nLevel 1 - S103ABC (520 th.)"
  function extractRoomFromHeader(header) {
    if (!header) return null;

    // Split by newline - room info is usually on the second line
    const lines = header.split('\n').map(l => l.trim()).filter(l => l);

    // Look for the line with room info (contains "Level" or is the location)
    for (const line of lines) {
      // Check for "Level X - ROOM" pattern
      const levelMatch = line.match(/Level\s*\d+\s*[-–]\s*([A-Z0-9\-]+)/i);
      if (levelMatch) {
        // Return full "Level X - ROOM" without capacity
        const withoutCapacity = line.replace(/\s*\([^)]*\)\s*$/, '').trim();
        return withoutCapacity;
      }

      // Check for "Hyatt" or other venue names
      if (line.toLowerCase().includes('hyatt') || line.toLowerCase().includes('ballroom')) {
        return line.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }

      // Check for Level 4 or similar formats
      if (line.match(/Level\s*\d+/i)) {
        return line.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }

    // Fallback: use last line without capacity
    if (lines.length > 0) {
      return lines[lines.length - 1].replace(/\s*\([^)]*\)\s*$/, '').trim();
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

  // Check if a cell contains actual session content
  function isRealSession(cellContent) {
    if (!cellContent || cellContent.trim() === '') return false;
    const trimmed = cellContent.trim();
    // Skip cells that are just "-" or "_" (meaning no session)
    if (trimmed === '-' || trimmed === '_' || trimmed === '–') return false;
    // Skip very short content
    if (trimmed.length < 3) return false;
    return true;
  }

  // Extract session name, speaker, and moderator from cell content
  // Google Sheet format varies - try multiple patterns
  function parseSessionCell(cellContent) {
    if (!cellContent) return null;

    const content = cellContent.trim();

    // Split by newlines and filter empty lines
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);

    if (lines.length === 0) return null;

    let sessionName = lines[0];
    let speaker = null;
    let moderator = null;

    // Collect potential speaker lines (lines 1 to n-1, or all if only 2 lines)
    const speakerLines = [];

    // Look for patterns in lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();

      // Skip non-speaker content
      if (lineLower === 'asl' || lineLower === 'asl translation') continue;
      if (lineLower.startsWith('sponsored by')) continue;

      // Check for moderator pattern
      if (lineLower.startsWith('moderator:') || lineLower.startsWith('mod:')) {
        moderator = line.replace(/^(moderator|mod):\s*/i, '').trim();
      }
      // Check for speaker pattern
      else if (lineLower.startsWith('speaker:') || lineLower.startsWith('by:')) {
        speaker = line.replace(/^(speaker|by):\s*/i, '').trim();
      }
      // Check if it looks like a speaker name (capitalized, contains letters)
      else if (/^[A-Z][a-z]+\s+[A-Z]/.test(line) || /^[A-Z][a-z]+\s+[a-z]+\s+[A-Z]/.test(line)) {
        // Remove trailing "ASL" if present
        const cleanLine = line.replace(/,?\s*ASL\s*$/i, '').trim();
        if (cleanLine) speakerLines.push(cleanLine);
      }
    }

    // If we found speaker lines but no explicit speaker, join them
    if (!speaker && speakerLines.length > 0) {
      speaker = speakerLines.join(', ');
    }

    return { sessionName, speaker, moderator, allLines: lines };
  }

  // Parse a single sheet into sessions
  function parseSheet(csvData, date) {
    const rows = parseCSV(csvData);
    if (rows.length < 3) return []; // Need title, headers, and at least one data row

    const sessions = [];

    // Row 0 is title (e.g., "• SATURDAY - DECEMBER 27, 2025 •"), skip it
    // Row 1 is headers
    const headers = rows[1];

    // Extract room names from headers (skip first column which is TIME)
    const rooms = headers.slice(1).map(h => ({
      original: h,
      room: extractRoomFromHeader(h)
    }));

    // Track last session per column for moderator assignment
    let lastSessionsPerColumn = {};

    // Process each row (skip title and header rows)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const timeStr = row[0]?.trim();
      const times = parseTimeRange(timeStr);

      if (times) {
        // This is a SESSION row (has valid time)
        lastSessionsPerColumn = {}; // Reset for new time slot

        for (let j = 1; j < row.length && j <= rooms.length; j++) {
          const cellContent = row[j];

          if (!isRealSession(cellContent)) continue;

          const parsed = parseSessionCell(cellContent);
          if (!parsed) continue;

          const session = {
            date,
            start_time: times.start_time,
            end_time: times.end_time,
            room: rooms[j - 1].room,
            room_header: rooms[j - 1].original,
            session_name: parsed.sessionName,
            speaker: parsed.speaker,
            moderator: parsed.moderator,
            all_lines: parsed.allLines,
            raw_content: cellContent
          };

          sessions.push(session);
          lastSessionsPerColumn[j] = session;
        }
      } else if (timeStr === '' || !timeStr) {
        // This is a MODERATOR row (no time, just moderator info)
        for (let j = 1; j < row.length && j <= rooms.length; j++) {
          const cellContent = row[j]?.trim();
          if (!cellContent) continue;

          // Check if this looks like moderator info (name + phone number pattern)
          const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(cellContent);
          const looksLikeName = /^[A-Z][a-z]+\s+[A-Z]/.test(cellContent);

          if ((hasPhone || looksLikeName) && lastSessionsPerColumn[j]) {
            // Extract moderator name (remove phone number)
            const moderatorName = cellContent
              .replace(/\s*\(?\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\s*\)?/g, '')
              .replace(/[‬]/g, '') // Remove special Unicode chars
              .trim();

            if (moderatorName && moderatorName.length > 2) {
              lastSessionsPerColumn[j].moderator = moderatorName;
            }
          }
        }
      }
    }

    return sessions;
  }

  // Find matching session in database
  // STRICT: Only match by room + time slot (most reliable)
  async function findMatchingSession(sheetSession) {
    // Match by room + start_time + date (ignore end time as it may differ slightly)
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

    if (roomMatch.rows.length > 1) {
      return { match: null, matchType: 'multiple_room_time', candidates: roomMatch.rows };
    }

    // No match by room+time - don't fall back to fuzzy name matching (too unreliable)
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

          // Normalize time format for comparison (remove seconds if present)
          const normalizeTime = (t) => t ? t.substring(0, 5) : null;
          const dbEndTime = normalizeTime(dbSession.end_time);
          const sheetEndTime = normalizeTime(sheetSession.end_time);

          // Check if end_time needs update
          if (sheetEndTime && dbEndTime !== sheetEndTime) {
            sessionChanges.push({
              field: 'end_time',
              old: dbSession.end_time,
              new: sheetSession.end_time
            });
          }

          // Check if speaker needs update (only if sheet has speaker data)
          if (sheetSession.speaker) {
            // Normalize speaker names for comparison (ignore case, punctuation differences)
            const normalizeSpeaker = (s) => s ? s.toLowerCase().replace(/[;&,]/g, ' ').replace(/\s+/g, ' ').trim() : '';
            const dbSpeakerNorm = normalizeSpeaker(dbSession.speaker);
            const sheetSpeakerNorm = normalizeSpeaker(sheetSession.speaker);

            if (dbSpeakerNorm !== sheetSpeakerNorm) {
              sessionChanges.push({
                field: 'speaker',
                old: dbSession.speaker,
                new: sheetSession.speaker
              });
            }
          }

          // Check if session name differs significantly (for logging, not auto-update)
          const normalizeTitle = (t) => t ? t.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
          const dbTitleNorm = normalizeTitle(dbSession.name);
          const sheetTitleNorm = normalizeTitle(sheetSession.session_name);
          if (dbTitleNorm !== sheetTitleNorm && sheetSession.session_name) {
            // Log name mismatch but don't auto-update (names should match already)
            logs.push({
              type: 'warning',
              message: `Session name mismatch at ${sheetSession.room} ${sheetSession.start_time}: DB="${dbSession.name}" vs Sheet="${sheetSession.session_name}"`
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
        } else if (result.matchType === 'multiple_room_time') {
          logs.push({
            type: 'warning',
            message: `Multiple DB sessions at ${sheetSession.room} ${sheetSession.start_time} - skipping`,
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
            let query = null;
            let params = null;

            if (fieldChange.field === 'speaker') {
              query = 'UPDATE sessions SET speaker = $1 WHERE id = $2';
              params = [fieldChange.new, change.dbSession.id];
            } else if (fieldChange.field === 'end_time') {
              query = 'UPDATE sessions SET end_time = $1 WHERE id = $2';
              params = [fieldChange.new, change.dbSession.id];
            }

            if (query) {
              await db.query(query, params);

              syncLog.push({
                timestamp: new Date().toISOString(),
                sessionId: change.dbSession.id,
                sessionName: change.dbSession.name,
                field: fieldChange.field,
                oldValue: fieldChange.old,
                newValue: fieldChange.new,
                status: 'success'
              });

              results.push({
                sessionId: change.dbSession.id,
                status: 'updated',
                field: fieldChange.field
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

  // GET /api/sync/diagnose - Diagnose why matching is failing
  fastify.get('/diagnose', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Get DB sessions with room info
      const dbResult = await db.query(`
        SELECT s.id, s.name, s.start_time, r.name as room_name, ed.date
        FROM sessions s
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN event_days ed ON s.event_day_id = ed.id
        ORDER BY ed.date, s.start_time
        LIMIT 10
      `);

      // Get unique room names from DB
      const dbRoomsResult = await db.query(`SELECT DISTINCT name FROM rooms ORDER BY name`);

      // Get Saturday sheet data (most reliable)
      const gid = '85377331';
      const csv = await fetchSheetCSV(gid);
      const rows = parseCSV(csv);
      // Row 0 is title, Row 1 is headers
      const headers = rows[1] || [];

      // Extract room info from headers
      const headerRooms = headers.slice(1).map((h, i) => ({
        colIndex: i + 1,
        fullHeader: h,
        extractedRoom: extractRoomFromHeader(h)
      }));

      // Get first few parsed sessions
      const sessions = parseSheet(csv, '2025-12-27');

      // Get unique rooms from sheet
      const sheetRooms = [...new Set(sessions.map(s => s.room))];

      return success({
        diagnosis: {
          dbSessionCount: dbResult.rows.length,
          dbRooms: dbRoomsResult.rows.map(r => r.name),
          sheetHeaderCount: headers.length,
          sheetHeaders: headerRooms,
          sheetRoomsExtracted: sheetRooms,
          parsedSessionCount: sessions.length
        },
        sampleDbSessions: dbResult.rows.slice(0, 5).map(s => ({
          name: s.name,
          room: s.room_name,
          time: s.start_time,
          date: s.date?.toISOString().split('T')[0]
        })),
        sampleSheetSessions: sessions.slice(0, 5).map(s => ({
          name: s.session_name,
          room: s.room,
          roomHeader: s.room_header,
          time: s.start_time,
          date: s.date
        })),
        matchTest: {
          description: "Testing if first DB session matches any sheet session",
          dbSession: dbResult.rows[0] ? {
            room: dbResult.rows[0].room_name,
            time: dbResult.rows[0].start_time?.substring(0, 5),
            date: dbResult.rows[0].date?.toISOString().split('T')[0]
          } : null,
          potentialMatches: sessions.filter(s => {
            const db = dbResult.rows[0];
            if (!db) return false;
            const dbDate = db.date?.toISOString().split('T')[0];
            const dbTime = db.start_time?.substring(0, 5);
            return s.date === dbDate && s.start_time === dbTime;
          }).map(s => ({
            room: s.room,
            roomHeader: s.room_header,
            name: s.session_name
          }))
        }
      });
    } catch (err) {
      throw err;
    }
  });

  // GET /api/sync/raw - Get raw CSV data from sheet
  fastify.get('/raw', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { date } = request.query;
    const targetDate = date || '2025-12-27';
    const gid = DATE_TO_GID[targetDate];

    if (!gid) {
      return validationError(`No GID configured for date: ${targetDate}`);
    }

    try {
      const csv = await fetchSheetCSV(gid);
      // Return first 5000 chars of raw CSV
      return success({
        date: targetDate,
        gid,
        csvLength: csv.length,
        csvPreview: csv.substring(0, 8000)
      });
    } catch (err) {
      throw err;
    }
  });

  // GET /api/sync/debug - Debug view of parsed sheet data
  fastify.get('/debug', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { date } = request.query;
    const targetDate = date || '2025-12-27'; // Default to Saturday
    const gid = DATE_TO_GID[targetDate];

    if (!gid) {
      return validationError(`No GID configured for date: ${targetDate}`);
    }

    try {
      const csv = await fetchSheetCSV(gid);
      const rows = parseCSV(csv);
      const sessions = parseSheet(csv, targetDate);

      // Debug: check each row for time parsing
      const rowAnalysis = rows.slice(1, 50).map((row, i) => {
        const timeStr = row[0];
        const times = parseTimeRange(timeStr);
        const nonEmptyCells = row.slice(1).filter(c => c && c.trim()).length;
        return {
          rowIndex: i + 1,
          timeCell: timeStr?.substring(0, 50),
          timeParsed: !!times,
          parsedTimes: times,
          nonEmptyCells
        };
      });

      // Row 0 is title, Row 1 is headers
      const headers = rows[1] || [];
      const headerRooms = headers.slice(1).map((h, i) => ({
        colIndex: i + 1,
        fullHeader: h?.substring(0, 80),
        extractedRoom: extractRoomFromHeader(h)
      }));

      // Return raw data for debugging
      return success({
        date: targetDate,
        gid,
        rawRowCount: rows.length,
        titleRow: rows[0]?.[0]?.substring(0, 50),
        headerCount: headers.length,
        headers: headerRooms,
        rowAnalysis,
        rowsWithValidTime: rowAnalysis.filter(r => r.timeParsed).length,
        rowsSkipped: rowAnalysis.filter(r => !r.timeParsed).length,
        parsedSessionCount: sessions.length,
        parsedSessions: sessions.map(s => ({
          room: s.room,
          time: `${s.start_time} - ${s.end_time}`,
          sessionName: s.session_name,
          speaker: s.speaker,
          moderator: s.moderator,
          lineCount: s.all_lines?.length,
          rawContent: s.raw_content?.substring(0, 300)
        }))
      });
    } catch (err) {
      throw err;
    }
  });

  // GET /api/sync/match-check - Check all DB sessions against sheet data
  fastify.get('/match-check', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Get all sessions from database
      const dbResult = await db.query(`
        SELECT s.id, s.name, s.speaker, s.start_time, s.end_time,
               r.name as room_name, ed.date
        FROM sessions s
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN event_days ed ON s.event_day_id = ed.id
        ORDER BY ed.date, s.start_time, r.name
      `);
      const dbSessions = dbResult.rows;

      // Fetch all sheet data with per-sheet counts
      const allSheetSessions = [];
      const sheetCounts = {};
      for (const [dateStr, gid] of Object.entries(DATE_TO_GID)) {
        try {
          const csv = await fetchSheetCSV(gid);
          const sessions = parseSheet(csv, dateStr);
          sheetCounts[dateStr] = sessions.length;
          allSheetSessions.push(...sessions);
        } catch (err) {
          sheetCounts[dateStr] = `Error: ${err.message}`;
        }
      }

      // Check each DB session for a match
      const matchResults = [];
      const matchedSheetIndices = new Set();

      for (const dbSession of dbSessions) {
        const dateStr = dbSession.date?.toISOString().split('T')[0];
        const dbStartTime = dbSession.start_time?.substring(0, 5);

        // Find matching sheet session
        let matchedSheet = null;
        let matchIndex = -1;

        for (let i = 0; i < allSheetSessions.length; i++) {
          const sheet = allSheetSessions[i];
          if (sheet.date === dateStr &&
              sheet.start_time === dbStartTime &&
              dbSession.room_name?.toLowerCase().includes(sheet.room?.toLowerCase())) {
            matchedSheet = sheet;
            matchIndex = i;
            matchedSheetIndices.add(i);
            break;
          }
        }

        matchResults.push({
          dbId: dbSession.id,
          dbName: dbSession.name,
          dbRoom: dbSession.room_name,
          dbTime: `${dbSession.start_time} - ${dbSession.end_time}`,
          dbDate: dateStr,
          dbSpeaker: dbSession.speaker,
          matched: !!matchedSheet,
          sheetName: matchedSheet?.session_name || null,
          sheetSpeaker: matchedSheet?.speaker || null,
          sheetModerator: matchedSheet?.moderator || null,
          sheetRoom: matchedSheet?.room || null,
          sheetTime: matchedSheet ? `${matchedSheet.start_time} - ${matchedSheet.end_time}` : null
        });
      }

      // Find unmatched sheet sessions
      const unmatchedSheetSessions = allSheetSessions
        .filter((_, i) => !matchedSheetIndices.has(i))
        .map(s => ({
          name: s.session_name,
          room: s.room,
          time: `${s.start_time} - ${s.end_time}`,
          date: s.date,
          speaker: s.speaker
        }));

      const matched = matchResults.filter(r => r.matched);
      const unmatched = matchResults.filter(r => !r.matched);

      return success({
        summary: {
          totalDbSessions: dbSessions.length,
          totalSheetSessions: allSheetSessions.length,
          sheetCounts,
          matched: matched.length,
          unmatched: unmatched.length,
          unmatchedSheetSessions: unmatchedSheetSessions.length
        },
        matched,
        unmatched,
        unmatchedSheetSessions: unmatchedSheetSessions.slice(0, 50)
      });
    } catch (err) {
      fastify.log.error('Match check error:', err);
      throw err;
    }
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
