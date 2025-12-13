import pg from 'pg';
import fp from 'fastify-plugin';

const { Pool } = pg;

async function dbPlugin(fastify, options) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }

  // Decorate fastify with db
  fastify.decorate('db', {
    query: (text, params) => pool.query(text, params),
    pool
  });

  // Close pool on shutdown
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export { dbPlugin };
export default fp(dbPlugin, { name: 'db' });
