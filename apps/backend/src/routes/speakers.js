import { success, notFound, validationError } from '../utils/responses.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

export default async function speakersRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/speakers - Get all speakers
  fastify.get('/', async (request, reply) => {
    const result = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM sessions sess WHERE sess.speaker LIKE '%' || s.name || '%') as session_count
      FROM speakers s
      ORDER BY s.name
    `);
    return success(result.rows);
  });

  // GET /api/speakers/:id - Get single speaker
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query('SELECT * FROM speakers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw notFound('Speaker');
    }

    return success(result.rows[0]);
  });

  // POST /api/speakers/:id/upload - Upload/replace speaker file
  fastify.post('/:id/upload', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    // Get speaker
    const speakerResult = await db.query('SELECT * FROM speakers WHERE id = $1', [id]);
    if (speakerResult.rows.length === 0) {
      throw notFound('Speaker');
    }

    const speaker = speakerResult.rows[0];

    // Get the file from multipart
    const data = await request.file();
    if (!data) {
      throw validationError('No file uploaded');
    }

    // Validate file type
    if (data.mimetype !== 'application/pdf') {
      throw validationError('Only PDF files are allowed');
    }

    // Read file buffer
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Generate filename: Speaker Name (FINAL).pdf
    const filename = `${speaker.name} (FINAL).pdf`;
    const s3Key = `speakers/${filename}`;

    // Upload to R2
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    }));

    // Generate public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/speakers/${encodeURIComponent(filename)}`;

    // Update database
    await db.query(
      'UPDATE speakers SET file_url = $1 WHERE id = $2',
      [publicUrl, id]
    );

    return success({
      message: 'File uploaded successfully',
      file_url: publicUrl
    });
  });

  // DELETE /api/speakers/:id/file - Remove speaker file
  fastify.delete('/:id/file', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'UPDATE speakers SET file_url = NULL WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Speaker');
    }

    return success({ message: 'File removed', speaker: result.rows[0] });
  });

  // PUT /api/speakers/:id - Update speaker info
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, file_url } = request.body;

    const result = await db.query(
      `UPDATE speakers
       SET name = COALESCE($1, name),
           file_url = COALESCE($2, file_url)
       WHERE id = $3
       RETURNING *`,
      [name, file_url, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Speaker');
    }

    return success(result.rows[0]);
  });
}
