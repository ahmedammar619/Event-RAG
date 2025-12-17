import pg from 'pg';
import fp from 'fastify-plugin';

const { Pool } = pg;

async function ragDbPlugin(fastify, options) {
  const connectionString = process.env.RAG_DATABASE_URL;

  if (!connectionString) {
    console.error('RAG_DATABASE_URL not set, RAG features will be disabled');
    return;
  }

  // Try connecting - first without SSL, then with SSL if that fails
  let pool;
  let connected = false;

  // First try without SSL (Railway internal doesn't need SSL)
  try {
    pool = new Pool({
      connectionString,
      ssl: false
    });
    const client = await pool.connect();
    console.log('RAG Database connected successfully (no SSL)');
    client.release();
    connected = true;
  } catch (err) {
    console.log('RAG Database connection without SSL failed, trying with SSL...');
    await pool?.end();

    // Try with SSL
    try {
      pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });
      const client = await pool.connect();
      console.log('RAG Database connected successfully (with SSL)');
      client.release();
      connected = true;
    } catch (sslErr) {
      console.error('RAG Database connection failed:', sslErr.message);
      console.error('RAG features will be disabled');
      return;
    }
  }

  if (!connected) {
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
