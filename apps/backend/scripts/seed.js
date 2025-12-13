import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  console.log('Starting database seed...');

  try {
    // Create default admin
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(`
      INSERT INTO admins (username, email, password_hash, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE SET password_hash = $3
    `, [adminUsername, 'admin@mascon.org', passwordHash, 'Admin']);

    console.log(`Admin created: ${adminUsername}`);

    // Clear existing data for fresh seed
    await pool.query('DELETE FROM assignments');
    await pool.query('DELETE FROM availability');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM moderators');
    await pool.query('DELETE FROM rooms');
    await pool.query('DELETE FROM event_days');
    console.log('Cleared existing data');

    // Create sample event days (example: MASCON 2025)
    const eventDays = [
      { date: '2025-03-14', start_time: '09:00', end_time: '18:00' },
      { date: '2025-03-15', start_time: '09:00', end_time: '18:00' },
      { date: '2025-03-16', start_time: '09:00', end_time: '15:00' }
    ];

    const dayIds = [];
    for (const day of eventDays) {
      const result = await pool.query(
        'INSERT INTO event_days (date, start_time, end_time) VALUES ($1, $2, $3) RETURNING id',
        [day.date, day.start_time, day.end_time]
      );
      dayIds.push(result.rows[0].id);
    }
    console.log(`Event days created: ${eventDays.length}`);

    // Create sample rooms
    const rooms = [
      { name: 'Main Hall', capacity: 500 },
      { name: 'Hall A', capacity: 200 },
      { name: 'Hall B', capacity: 200 },
      { name: 'Room 101', capacity: 50 },
      { name: 'Room 102', capacity: 50 },
      { name: 'Room 103', capacity: 30 }
    ];

    const roomIds = [];
    for (const room of rooms) {
      const result = await pool.query(
        'INSERT INTO rooms (name, capacity) VALUES ($1, $2) RETURNING id',
        [room.name, room.capacity]
      );
      roomIds.push(result.rows[0].id);
    }
    console.log(`Rooms created: ${rooms.length}`);

    // Create sample moderators with different schedule preferences
    const moderators = [
      { name: 'Ahmed Hassan', email: 'ahmed.hassan@example.com', phone: '555-0101', pref: 'consecutive' },
      { name: 'Fatima Ali', email: 'fatima.ali@example.com', phone: '555-0102', pref: 'spread_out' },
      { name: 'Omar Khalid', email: 'omar.khalid@example.com', phone: '555-0103', pref: 'no_preference' },
      { name: 'Aisha Mohammed', email: 'aisha.mohammed@example.com', phone: '555-0104', pref: 'consecutive' },
      { name: 'Yusuf Ibrahim', email: 'yusuf.ibrahim@example.com', phone: '555-0105', pref: 'spread_out' },
      { name: 'Mariam Noor', email: 'mariam.noor@example.com', phone: '555-0106', pref: 'no_preference' },
      { name: 'Hassan Tariq', email: 'hassan.tariq@example.com', phone: '555-0107', pref: 'consecutive' },
      { name: 'Layla Ahmed', email: 'layla.ahmed@example.com', phone: '555-0108', pref: 'spread_out' },
      { name: 'Kareem Said', email: 'kareem.said@example.com', phone: '555-0109', pref: 'no_preference' },
      { name: 'Nadia Rashid', email: 'nadia.rashid@example.com', phone: '555-0110', pref: 'consecutive' }
    ];

    const modIds = [];
    for (const mod of moderators) {
      const result = await pool.query(
        'INSERT INTO moderators (name, email, phone, schedule_preference) VALUES ($1, $2, $3, $4) RETURNING id',
        [mod.name, mod.email, mod.phone, mod.pref]
      );
      modIds.push(result.rows[0].id);
    }
    console.log(`Moderators created: ${moderators.length}`);

    // Create sample sessions (all need 1 moderator)
    const sessions = [
      // Day 1
      { name: 'Opening Ceremony', day_idx: 0, room_idx: 0, start: '09:00', end: '10:00', mods_needed: 1 },
      { name: 'Keynote: Future of Islamic Education', day_idx: 0, room_idx: 0, start: '10:30', end: '12:00', mods_needed: 1 },
      { name: 'Workshop: Youth Engagement', day_idx: 0, room_idx: 1, start: '10:30', end: '12:00', mods_needed: 1 },
      { name: 'Panel: Community Building', day_idx: 0, room_idx: 2, start: '10:30', end: '12:00', mods_needed: 1 },
      { name: 'Lunch Break', day_idx: 0, room_idx: 0, start: '12:00', end: '13:30', mods_needed: 1 },
      { name: 'Workshop: Digital Dawah', day_idx: 0, room_idx: 3, start: '14:00', end: '15:30', mods_needed: 1 },
      { name: 'Seminar: Family Values', day_idx: 0, room_idx: 4, start: '14:00', end: '15:30', mods_needed: 1 },
      { name: 'Evening Program', day_idx: 0, room_idx: 0, start: '16:00', end: '18:00', mods_needed: 1 },

      // Day 2
      { name: 'Morning Session: Spiritual Growth', day_idx: 1, room_idx: 0, start: '09:00', end: '10:30', mods_needed: 1 },
      { name: 'Breakout: Leadership Skills', day_idx: 1, room_idx: 1, start: '11:00', end: '12:30', mods_needed: 1 },
      { name: 'Breakout: Mental Health Awareness', day_idx: 1, room_idx: 2, start: '11:00', end: '12:30', mods_needed: 1 },
      { name: 'Lunch & Networking', day_idx: 1, room_idx: 0, start: '12:30', end: '14:00', mods_needed: 1 },
      { name: 'Workshop: Public Speaking', day_idx: 1, room_idx: 3, start: '14:30', end: '16:00', mods_needed: 1 },
      { name: 'Panel: Interfaith Dialogue', day_idx: 1, room_idx: 0, start: '16:30', end: '18:00', mods_needed: 1 },

      // Day 3
      { name: 'Closing Keynote', day_idx: 2, room_idx: 0, start: '09:00', end: '10:30', mods_needed: 1 },
      { name: 'Community Awards', day_idx: 2, room_idx: 0, start: '11:00', end: '12:30', mods_needed: 1 },
      { name: 'Farewell Lunch', day_idx: 2, room_idx: 0, start: '12:30', end: '15:00', mods_needed: 1 }
    ];

    const sessionIds = [];
    for (const session of sessions) {
      const result = await pool.query(
        `INSERT INTO sessions (name, event_day_id, room_id, start_time, end_time, moderators_needed)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [session.name, dayIds[session.day_idx], roomIds[session.room_idx], session.start, session.end, session.mods_needed]
      );
      sessionIds.push(result.rows[0].id);
    }
    console.log(`Sessions created: ${sessions.length}`);

    // Create availability for moderators
    // Each moderator is available for different portions of the event
    // Some have multiple time slots on the same day (e.g., morning and evening)
    const availabilityPatterns = [
      // Full availability for all days
      [{ day: 0, start: '09:00', end: '18:00' }, { day: 1, start: '09:00', end: '18:00' }, { day: 2, start: '09:00', end: '15:00' }],
      // Day 1 and 2 only
      [{ day: 0, start: '09:00', end: '18:00' }, { day: 1, start: '09:00', end: '18:00' }],
      // Day 2 and 3 only
      [{ day: 1, start: '09:00', end: '18:00' }, { day: 2, start: '09:00', end: '15:00' }],
      // Split availability - morning and evening on same day
      [{ day: 0, start: '09:00', end: '12:00' }, { day: 0, start: '16:00', end: '18:00' }, { day: 1, start: '09:00', end: '12:00' }, { day: 1, start: '16:00', end: '18:00' }],
      // Afternoons only
      [{ day: 0, start: '13:00', end: '18:00' }, { day: 1, start: '13:00', end: '18:00' }],
      // Day 1 only - split morning/afternoon
      [{ day: 0, start: '09:00', end: '11:00' }, { day: 0, start: '14:00', end: '18:00' }],
      // Day 2 only - full
      [{ day: 1, start: '09:00', end: '18:00' }],
      // Day 3 only - full
      [{ day: 2, start: '09:00', end: '15:00' }],
      // Multiple slots across days
      [{ day: 0, start: '10:00', end: '13:00' }, { day: 0, start: '15:00', end: '17:00' }, { day: 1, start: '10:00', end: '14:00' }, { day: 2, start: '10:00', end: '14:00' }],
      // Days 1 and 3 with gaps
      [{ day: 0, start: '09:00', end: '12:00' }, { day: 0, start: '14:00', end: '16:00' }, { day: 2, start: '09:00', end: '15:00' }]
    ];

    let availCount = 0;
    for (let i = 0; i < modIds.length; i++) {
      const pattern = availabilityPatterns[i % availabilityPatterns.length];
      for (const slot of pattern) {
        await pool.query(
          'INSERT INTO availability (moderator_id, event_day_id, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [modIds[i], dayIds[slot.day], slot.start, slot.end]
        );
        availCount++;
      }
    }
    console.log(`Availability slots created: ${availCount}`);

    // Create some sample assignments
    const assignments = [
      { session_idx: 0, mod_idx: 0 }, // Opening Ceremony - Ahmed
      { session_idx: 0, mod_idx: 1 }, // Opening Ceremony - Fatima
      { session_idx: 0, mod_idx: 2 }, // Opening Ceremony - Omar
      { session_idx: 1, mod_idx: 3 }, // Keynote - Aisha
      { session_idx: 1, mod_idx: 4 }, // Keynote - Yusuf
      { session_idx: 8, mod_idx: 5 }, // Day 2 Morning - Mariam
      { session_idx: 8, mod_idx: 6 }, // Day 2 Morning - Hassan
    ];

    for (const assign of assignments) {
      await pool.query(
        `INSERT INTO assignments (session_id, moderator_id, assigned_by) VALUES ($1, $2, 'seed')`,
        [sessionIds[assign.session_idx], modIds[assign.mod_idx]]
      );
    }
    console.log(`Assignments created: ${assignments.length}`);

    console.log('');
    console.log('Seed completed successfully!');
    console.log('');
    console.log('Admin Login:');
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('');
    console.log('Sample Data:');
    console.log(`  - ${eventDays.length} Event Days`);
    console.log(`  - ${rooms.length} Rooms`);
    console.log(`  - ${moderators.length} Moderators`);
    console.log(`  - ${sessions.length} Sessions`);
    console.log(`  - ${availCount} Availability Slots`);
    console.log(`  - ${assignments.length} Pre-assigned Moderators`);

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
