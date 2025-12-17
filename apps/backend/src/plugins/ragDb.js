import pg from 'pg';
import fp from 'fastify-plugin';

const { Pool } = pg;

async function ragDbPlugin(fastify, options) {
  const pool = new Pool({
    connectionString: process.env.RAG_DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('RAG Database connected successfully');
    client.release();
  } catch (err) {
    console.error('RAG Database connection failed:', err.message);
    // Don't throw - RAG is optional, main app should still work
    console.error('RAG features will be disabled');
    return;
  }

  // Decorate fastify with ragDb
  fastify.decorate('ragDb', {
    query: (text, params) => pool.query(text, params),
    pool
  });

  // Close pool on shutdown
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export { ragDbPlugin };
export default fp(ragDbPlugin, { name: 'ragDb' });
