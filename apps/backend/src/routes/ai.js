import { success, notFound, validationError } from '../utils/responses.js';
import {
  searchSessions,
  generateReasoning,
  getAllSessions,
  getSessionById,
  logQuery
} from '../services/ragService.js';
import {
  getAllSettings,
  getSearchMode,
  setSearchMode,
  getDefaultResultCount,
  setDefaultResultCount
} from '../services/aiSettingsService.js';
import { testEmbeddingService } from '../services/embeddingService.js';
import { testLanguageService } from '../services/languageService.js';
import { testQueryParser } from '../services/queryParserService.js';

export default async function aiRoutes(fastify, options) {
  const { ragDb } = fastify;

  // Check if RAG database is available
  if (!ragDb) {
    fastify.log.warn('RAG database not available, AI routes disabled');
    return;
  }

  // ==========================================
  // STEP 1: Fast Search (No LLM reasoning)
  // ==========================================

  // POST /api/ai/search
  fastify.post('/search', async (request, reply) => {
    const { query } = request.body;

    if (!query || query.trim().length === 0) {
      throw validationError('Query is required');
    }

    // Get default result count from settings
    const limit = await getDefaultResultCount(ragDb);

    // Perform search (mode is determined by settings)
    const results = await searchSessions(ragDb, query.trim(), { limit: limit * 3 }); // Get more than needed for selection

    // Log the query for analytics (optional visitor ID from token)
    try {
      const visitorId = request.user?.role === 'visitor' ? request.user.id : null;
      await logQuery(ragDb, visitorId, {
        query_original: results.query_original,
        query_english: results.query_english,
        language_detected: results.language_detected,
        results_count: results.total_matches,
        search_mode: results.mode
      });
    } catch (err) {
      // Don't fail the request if logging fails
      fastify.log.error('Failed to log query:', err.message);
    }

    return success(results);
  });

  // ==========================================
  // STEP 2: Generate Reasoning (LLM call)
  // ==========================================

  // POST /api/ai/reasoning
  fastify.post('/reasoning', async (request, reply) => {
    const { query, session_ids } = request.body;

    if (!query || !session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      throw validationError('Query and session_ids array are required');
    }

    // Fetch the sessions by IDs
    const placeholders = session_ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await ragDb.query(
      `SELECT * FROM sessions WHERE id IN (${placeholders})`,
      session_ids
    );

    if (result.rows.length === 0) {
      throw notFound('Sessions');
    }

    // Format sessions for reasoning
    const sessions = result.rows.map(row => ({
      session: {
        id: row.id,
        title: row.title,
        date: row.date,
        time_start: row.time_start,
        time_end: row.time_end,
        track: row.track,
        room: row.room,
        speakers: row.speakers,
        description_english: row.description_english || row.description_original,
        session_type: row.session_type
      }
    }));

    // Generate AI reasoning
    const withReasoning = await generateReasoning(query, sessions);

    return success({
      query,
      recommendations: withReasoning
    });
  });

  // ==========================================
  // Browse Sessions (No AI)
  // ==========================================

  // GET /api/ai/sessions
  fastify.get('/sessions', async (request, reply) => {
    const { date, track, limit } = request.query;

    const sessions = await getAllSessions(ragDb, {
      date,
      track,
      limit: limit ? parseInt(limit) : 100
    });

    return success(sessions);
  });

  // GET /api/ai/sessions/:id
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params;

    const session = await getSessionById(ragDb, parseInt(id));

    if (!session) {
      throw notFound('Session');
    }

    return success(session);
  });

  // ==========================================
  // Admin Settings Endpoints
  // ==========================================

  // GET /api/ai/settings (admin only)
  fastify.get('/settings', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const settings = await getAllSettings(ragDb);
    return success(settings);
  });

  // PUT /api/ai/settings/search-mode (admin only)
  fastify.put('/settings/search-mode', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const { mode } = request.body;

    if (!mode || !['direct', 'smart'].includes(mode)) {
      throw validationError('Mode must be "direct" or "smart"');
    }

    await setSearchMode(ragDb, mode);

    return success({ search_mode: mode });
  });

  // PUT /api/ai/settings/result-count (admin only)
  fastify.put('/settings/result-count', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const { count } = request.body;

    if (!count || count < 1 || count > 50) {
      throw validationError('Count must be between 1 and 50');
    }

    await setDefaultResultCount(ragDb, count);

    return success({ default_result_count: count });
  });

  // ==========================================
  // Health/Status Endpoints
  // ==========================================

  // GET /api/ai/health
  fastify.get('/health', async (request, reply) => {
    const [embeddingStatus, languageStatus, parserStatus] = await Promise.all([
      testEmbeddingService(),
      testLanguageService(),
      testQueryParser()
    ]);

    const searchMode = await getSearchMode(ragDb);

    return success({
      status: 'ok',
      search_mode: searchMode,
      services: {
        embedding: embeddingStatus,
        language: languageStatus,
        queryParser: parserStatus
      }
    });
  });
}
