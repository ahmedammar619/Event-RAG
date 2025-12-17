import { success, notFound, validationError } from '../utils/responses.js';
import {
  searchSessions,
  generateReasoning,
  getAllSessions,
  getSessionById,
  logQuery
} from '../services/ragService.js';

/**
 * Parse user agent string to extract device, browser, and OS info
 */
function parseUserAgent(ua) {
  if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown' };

  // Device detection
  let device = 'desktop';
  if (/mobile/i.test(ua)) device = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';

  // Browser detection
  let browser = 'unknown';
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';
  else if (/msie|trident/i.test(ua)) browser = 'IE';

  // OS detection
  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os|macos/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return { device, browser, os };
}
import {
  getAllSettings,
  getSearchMode,
  setSearchMode,
  getDefaultResultCount,
  setDefaultResultCount,
  getLlmModel,
  setLlmModel,
  getReasoningMode,
  setReasoningMode
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
  fastify.post('/search', {
    preHandler: [fastify.optionalAuth]
  }, async (request, reply) => {
    const { query, session_id } = request.body;

    if (!query || query.trim().length === 0) {
      throw validationError('Query is required');
    }

    // Get default result count from settings
    const limit = await getDefaultResultCount(ragDb);

    // Get reasoning mode to include in response
    const reasoningMode = await getReasoningMode(ragDb);

    // Perform search (mode is determined by settings)
    const results = await searchSessions(ragDb, query.trim(), { limit: limit * 3 }); // Get more than needed for selection

    // Log the query for analytics
    try {
      // Get user ID - could be visitor, admin, or moderator
      // If they're logged in as any role, capture their ID
      const visitorId = request.user?.id || null;
      const userRole = request.user?.role || 'anonymous';

      // Get IP address (handle proxies)
      const ip_address = request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                         request.headers['x-real-ip'] ||
                         request.ip ||
                         null;

      // Get user agent
      const user_agent = request.headers['user-agent'] || null;

      // Parse user agent for device info
      const deviceInfo = parseUserAgent(user_agent);

      // Get referer
      const referer = request.headers['referer'] || request.headers['referrer'] || null;

      await logQuery(ragDb, visitorId, {
        query_original: results.query_original,
        query_english: results.query_english,
        language_detected: results.language_detected,
        results_count: results.total_matches,
        search_mode: results.mode,
        user_role: userRole,
        // Analytics data
        ip_address,
        user_agent,
        device_type: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: null, // Would need IP geolocation service
        city: null,
        region: null,
        referer,
        session_id: session_id || null
      });
    } catch (err) {
      // Don't fail the request if logging fails
      fastify.log.error('Failed to log query:', err.message);
    }

    // Include reasoning_mode so frontend knows whether to show count selector
    return success({
      ...results,
      reasoning_mode: reasoningMode
    });
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

    // Generate AI reasoning (passes ragDb for settings lookup)
    const withReasoning = await generateReasoning(ragDb, query, sessions);

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

  // PUT /api/ai/settings/llm-model (admin only)
  fastify.put('/settings/llm-model', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const { model } = request.body;

    if (!model || !['gemma3:270m', 'gemma3-4b'].includes(model)) {
      throw validationError('Model must be "gemma3:270m" or "gemma3-4b"');
    }

    await setLlmModel(ragDb, model);

    return success({ llm_model: model });
  });

  // PUT /api/ai/settings/reasoning-mode (admin only)
  fastify.put('/settings/reasoning-mode', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const { mode } = request.body;

    if (!mode || !['full', 'embedding_only'].includes(mode)) {
      throw validationError('Mode must be "full" or "embedding_only"');
    }

    await setReasoningMode(ragDb, mode);

    return success({ reasoning_mode: mode });
  });

  // ==========================================
  // Analytics Endpoints
  // ==========================================

  // GET /api/ai/analytics (admin only)
  fastify.get('/analytics', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const { days = 7 } = request.query;
    const daysInt = parseInt(days);

    // Get totals from query_logs (primary source)
    const totals = await ragDb.query(`
      SELECT
        COUNT(*) as total_searches,
        COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as logged_in_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(*) FILTER (WHERE detected_language = 'arabic') as arabic_queries,
        COUNT(*) FILTER (WHERE detected_language = 'english') as english_queries,
        COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_queries,
        COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_queries,
        COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_queries
      FROM query_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
    `);

    // Get daily breakdown
    const dailyStats = await ragDb.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as searches,
        COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as logged_in,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) FILTER (WHERE detected_language = 'arabic') as arabic,
        COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile
      FROM query_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Get device breakdown
    const deviceStats = await ragDb.query(`
      SELECT
        device_type,
        browser,
        os,
        COUNT(*) as count
      FROM query_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
        AND device_type IS NOT NULL
      GROUP BY device_type, browser, os
      ORDER BY count DESC
      LIMIT 20
    `);

    // Get top queries
    const topQueries = await ragDb.query(`
      SELECT
        query_original,
        detected_language,
        COUNT(*) as count,
        AVG(results_count)::integer as avg_results
      FROM query_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
      GROUP BY query_original, detected_language
      ORDER BY count DESC
      LIMIT 10
    `);

    // Get geographic breakdown (if available)
    const geoStats = await ragDb.query(`
      SELECT
        country,
        COUNT(*) as count,
        COUNT(DISTINCT ip_address) as unique_visitors
      FROM query_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `);

    // Try to get from search_analytics too (if exists)
    let modelUsage = { rows: [] };
    try {
      modelUsage = await ragDb.query('SELECT * FROM model_usage_stats');
    } catch (err) {
      // View might not exist
    }

    return success({
      totals: totals.rows[0],
      daily: dailyStats.rows,
      devices: deviceStats.rows,
      top_queries: topQueries.rows,
      geography: geoStats.rows,
      model_usage: modelUsage.rows
    });
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
