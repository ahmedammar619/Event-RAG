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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mascom.org';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(`
      INSERT INTO admins (email, password_hash, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2
    `, [adminEmail, passwordHash, 'Admin']);

    console.log(`Admin created: ${adminEmail}`);

    // Create sample event days (example: MASCOM 2025)
    const eventDays = [
      { date: '2025-03-14', start_time: '09:00', end_time: '18:00' },
      { date: '2025-03-15', start_time: '09:00', end_time: '18:00' },
      { date: '2025-03-16', start_time: '09:00', end_time: '15:00' }
    ];

    for (const day of eventDays) {
      await pool.query(`
        INSERT INTO event_days (date, start_time, end_time)
        VALUES ($1, $2, $3)
        ON CONFLICT (date) DO NOTHING
      `, [day.date, day.start_time, day.end_time]);
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

    for (const room of rooms) {
      const existing = await pool.query('SELECT id FROM rooms WHERE name = $1', [room.name]);
      if (existing.rows.length === 0) {
        await pool.query('INSERT INTO rooms (name, capacity) VALUES ($1, $2)', [room.name, room.capacity]);
      }
    }

    console.log(`Rooms created: ${rooms.length}`);

    console.log('Seed completed successfully!');
    console.log('');
    console.log('Admin Login:');
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
