import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Tracks to exclude (patterns to match - case insensitive)
const EXCLUDE_PATTERNS = [
  'retreat',      // All retreats (English, Arabic)
  'english',
  'arabic',
  'main',
  'college',
  'young professional',
  'youth',
  'msa national',
  'amps',
  'professional society',
  'ispu',
  'activism',
  'women',
  'community',
  'beam',
  'venture',
  'research',
  'latinos',
  'ojalá',
  'faith power',
  'leadership',
  'yaqeen',
  'african',
  'mana',
  'tarbiya',
  'bis',
  'amp',
  'reverts',
  'quran',
  'bidaya',
  'asl'
];

// Check if a track should be excluded
function shouldExcludeTrack(track) {
  if (!track) return true;
  const trackLower = track.toLowerCase();
  return EXCLUDE_PATTERNS.some(pattern => trackLower.includes(pattern));
}

// Convert 12-hour time (e.g., "10:00 AM") to 24-hour format (e.g., "10:00")
function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.trim().split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours, 10);

  if (modifier.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (modifier.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// Convert date from MM/DD/YYYY to YYYY-MM-DD
function convertDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function importData(csvPath) {
  console.log('Starting import from:', csvPath);
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  // Read and parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Found ${records.length} total records in CSV`);

  // Filter records by track
  const filteredRecords = records.filter(record => {
    const track = record['Tracks']?.trim();
    return !shouldExcludeTrack(track);
  });
  console.log(`After track filter: ${filteredRecords.length} records to import`);
  console.log(`Excluded: ${records.length - filteredRecords.length} records`);

  // Extract unique rooms (only from filtered records)
  const roomsSet = new Set();
  filteredRecords.forEach(record => {
    const room = record['Room/Location']?.trim();
    if (room) {
      roomsSet.add(room);
    }
  });
  const uniqueRooms = Array.from(roomsSet).sort();
  console.log(`Found ${uniqueRooms.length} unique rooms`);

  // Extract unique dates with their time ranges (only from filtered records)
  const dayData = {};
  filteredRecords.forEach(record => {
    const date = record['*Date']?.trim();
    const startTime = record['*Time Start']?.trim();
    const endTime = record['*Time End']?.trim();

    if (date && startTime && endTime) {
      if (!dayData[date]) {
        dayData[date] = { starts: [], ends: [] };
      }
      dayData[date].starts.push(startTime);
      dayData[date].ends.push(endTime);
    }
  });

  // Calculate min start and max end for each day
  const eventDays = Object.keys(dayData).sort().map(date => {
    const starts = dayData[date].starts.map(t => convertTo24Hour(t)).sort();
    const ends = dayData[date].ends.map(t => convertTo24Hour(t)).sort();
    return {
      date: convertDate(date),
      originalDate: date,
      start_time: starts[0], // earliest start
      end_time: ends[ends.length - 1] // latest end
    };
  });
  console.log(`Found ${eventDays.length} event days`);

  try {
    // Start transaction
    await pool.query('BEGIN');

    // 1. Insert rooms
    console.log('\n--- Inserting Rooms ---');
    const roomIdMap = {};
    for (const roomName of uniqueRooms) {
      const result = await pool.query(
        'INSERT INTO rooms (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
        [roomName]
      );

      if (result.rows.length > 0) {
        roomIdMap[roomName] = result.rows[0].id;
        console.log(`  Inserted room: ${roomName} (ID: ${result.rows[0].id})`);
      } else {
        // Room already exists, fetch its ID
        const existing = await pool.query('SELECT id FROM rooms WHERE name = $1', [roomName]);
        if (existing.rows.length > 0) {
          roomIdMap[roomName] = existing.rows[0].id;
          console.log(`  Room exists: ${roomName} (ID: ${existing.rows[0].id})`);
        }
      }
    }

    // 2. Insert event days
    console.log('\n--- Inserting Event Days ---');
    const dayIdMap = {};
    for (const day of eventDays) {
      const result = await pool.query(
        'INSERT INTO event_days (date, start_time, end_time) VALUES ($1, $2, $3) ON CONFLICT (date) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time RETURNING id',
        [day.date, day.start_time, day.end_time]
      );

      dayIdMap[day.originalDate] = result.rows[0].id;
      console.log(`  Event day: ${day.date} (${day.start_time} - ${day.end_time}) ID: ${result.rows[0].id}`);
    }

    // 3. Insert sessions
    console.log('\n--- Inserting Sessions ---');
    let sessionsInserted = 0;
    let sessionsSkipped = 0;

    for (const record of filteredRecords) {
      const date = record['*Date']?.trim();
      const sessionTitle = record['*Session Title']?.trim();
      const startTime = record['*Time Start']?.trim();
      const endTime = record['*Time End']?.trim();
      const roomName = record['Room/Location']?.trim();

      if (!date || !sessionTitle || !startTime || !endTime) {
        console.log(`  Skipping incomplete record: ${sessionTitle || 'No title'}`);
        sessionsSkipped++;
        continue;
      }

      const eventDayId = dayIdMap[date];
      const roomId = roomName ? roomIdMap[roomName] : null;
      const startTime24 = convertTo24Hour(startTime);
      const endTime24 = convertTo24Hour(endTime);

      // Check if session already exists (same name, day, time, room)
      const existingSession = await pool.query(
        'SELECT id FROM sessions WHERE name = $1 AND event_day_id = $2 AND start_time = $3 AND end_time = $4',
        [sessionTitle, eventDayId, startTime24, endTime24]
      );

      if (existingSession.rows.length > 0) {
        console.log(`  Session exists: ${sessionTitle}`);
        sessionsSkipped++;
        continue;
      }

      await pool.query(
        'INSERT INTO sessions (name, event_day_id, room_id, start_time, end_time, moderators_needed) VALUES ($1, $2, $3, $4, $5, $6)',
        [sessionTitle, eventDayId, roomId, startTime24, endTime24, 1]
      );

      sessionsInserted++;
      if (sessionsInserted % 20 === 0) {
        console.log(`  Inserted ${sessionsInserted} sessions...`);
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    console.log('\n=== Import Summary ===');
    console.log(`Rooms: ${uniqueRooms.length}`);
    console.log(`Event Days: ${eventDays.length}`);
    console.log(`Sessions Inserted: ${sessionsInserted}`);
    console.log(`Sessions Skipped: ${sessionsSkipped}`);
    console.log('\nImport completed successfully!');

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Import failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Get CSV path from command line or use default
const csvPath = process.argv[2] || path.join(process.cwd(), '../../agenda_export_masco1_202512 (1).csv');

if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found:', csvPath);
  console.error('Usage: node scripts/import-sessions.js <path-to-csv>');
  process.exit(1);
}

importData(csvPath).catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});
