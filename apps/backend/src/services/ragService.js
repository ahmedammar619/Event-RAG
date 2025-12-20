/**
 * RAG Service - Core retrieval and reasoning logic
 * Supports dual-mode search: Direct (Mode B) and Smart (Mode A)
 * Uses Grok API for LLM reasoning via llmService
 */

import { generateEmbedding } from './embeddingService.js';
import { detectLanguage, translateToEnglish } from './languageService.js';
import { parseQuery, buildSQLFilters } from './queryParserService.js';
import { getSearchMode, getDefaultResultCount, getLlmModel, getReasoningMode } from './aiSettingsService.js';
import { generateCompletion } from './llmService.js';

/**
 * Main search function - routes to appropriate mode based on settings
 */
export async function searchSessions(ragDb, query, options = {}) {
  const mode = await getSearchMode(ragDb);
  console.log(`[SEARCH] Mode: ${mode}, Query: "${query.substring(0, 50)}..."`);

  if (mode === 'smart') {
    console.log('[SEARCH] Using SMART mode - will make LLM call for query parsing');
    return await searchSessionsSmart(ragDb, query, options);
  } else {
    console.log('[SEARCH] Using DIRECT mode - no LLM call for search');
    return await searchSessionsDirect(ragDb, query, options);
  }
}

/**
 * Mode B: Hybrid Search (Keyword + Vector)
 * Combines exact keyword matching with semantic vector search
 * Uses weighted blending for accurate relevance scores
 */
export async function searchSessionsDirect(ragDb, query, options = {}) {
  const { limit = 20, minSimilarity = 0.25 } = options;

  // Detect language
  const language = detectLanguage(query);

  // Translate if Arabic
  const searchQuery = language === 'arabic'
    ? await translateToEnglish(query)
    : query;

  // Extract keywords (words 3+ chars, lowercase, remove stopwords)
  const stopwords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'what', 'when', 'who', 'how', 'this', 'that', 'with', 'from', 'they', 'would', 'there', 'their', 'about', 'which', 'could', 'other', 'into', 'your', 'just', 'also', 'some', 'than', 'them', 'these', 'then', 'only', 'its', 'over', 'such', 'make', 'like', 'want', 'session', 'sessions', 'looking', 'find', 'search', 'best', 'good', 'need']);

  const keywords = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 3 && !stopwords.has(w));

  console.log(`[SEARCH] Keywords extracted: ${keywords.join(', ')}`);

  // Generate embedding for vector search
  const queryEmbedding = await generateEmbedding(searchQuery);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Single query: Get all sessions with both keyword and vector scores
  let sqlQuery;
  let sqlParams;

  if (keywords.length > 0) {
    // Build keyword scoring for each field
    const keywordScoreParts = keywords.map((_, i) => `(
      CASE WHEN LOWER(s.title) LIKE LOWER($${i + 1}) THEN 0.35 ELSE 0 END +
      CASE WHEN LOWER(s.speakers) LIKE LOWER($${i + 1}) THEN 0.25 ELSE 0 END +
      CASE WHEN LOWER(s.track) LIKE LOWER($${i + 1}) THEN 0.20 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(s.description_english, s.description_original, '')) LIKE LOWER($${i + 1}) THEN 0.10 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(s.tags, '')) LIKE LOWER($${i + 1}) THEN 0.10 ELSE 0 END
    )`).join(' + ');

    // Normalize keyword score by number of keywords (so more keywords = higher potential)
    const normalizedKeywordScore = `(${keywordScoreParts}) / ${keywords.length}`;

    sqlParams = [
      ...keywords.map(k => `%${k}%`),
      embeddingStr,
      minSimilarity,
      limit
    ];

    const embeddingParamIdx = keywords.length + 1;
    const minSimParamIdx = keywords.length + 2;
    const limitParamIdx = keywords.length + 3;

    sqlQuery = `
      SELECT
        s.*,
        se.searchable_text,
        1 - (se.embedding <=> $${embeddingParamIdx}::vector) as vector_similarity,
        ${normalizedKeywordScore} as keyword_score,
        -- Blend: 60% keyword (if matches) + 40% vector, or 100% vector if no keyword match
        CASE
          WHEN ${normalizedKeywordScore} > 0 THEN
            GREATEST(
              (0.6 * ${normalizedKeywordScore}) + (0.4 * (1 - (se.embedding <=> $${embeddingParamIdx}::vector))),
              1 - (se.embedding <=> $${embeddingParamIdx}::vector)
            )
          ELSE
            1 - (se.embedding <=> $${embeddingParamIdx}::vector)
        END as final_score
      FROM sessions s
      JOIN session_embeddings se ON s.id = se.session_id
      WHERE 1 - (se.embedding <=> $${embeddingParamIdx}::vector) >= $${minSimParamIdx}
         OR ${normalizedKeywordScore} > 0
      ORDER BY final_score DESC
      LIMIT $${limitParamIdx}
    `;
  } else {
    // No keywords - pure vector search
    sqlParams = [embeddingStr, minSimilarity, limit];
    sqlQuery = `
      SELECT
        s.*,
        se.searchable_text,
        1 - (se.embedding <=> $1::vector) as vector_similarity,
        0 as keyword_score,
        1 - (se.embedding <=> $1::vector) as final_score
      FROM sessions s
      JOIN session_embeddings se ON s.id = se.session_id
      WHERE 1 - (se.embedding <=> $1::vector) >= $2
      ORDER BY final_score DESC
      LIMIT $3
    `;
  }

  let result = await ragDb.query(sqlQuery, sqlParams);

  console.log(`[SEARCH] Found ${result.rows.length} results (min: ${minSimilarity})`);

  // FALLBACK: If too few results, retry with lower threshold
  if (result.rows.length < 3 && minSimilarity > 0.22) {
    const lowerThreshold = 0.22;
    console.log(`[SEARCH] Too few results, retrying with min: ${lowerThreshold}`);

    if (keywords.length > 0) {
      sqlParams[sqlParams.length - 2] = lowerThreshold; // Update minSimilarity param
    } else {
      sqlParams[1] = lowerThreshold;
    }

    result = await ragDb.query(sqlQuery, sqlParams);
    console.log(`[SEARCH] After fallback: ${result.rows.length} results`);
  }

  // Filter results below minimum threshold
  const filteredResults = result.rows.filter(row => parseFloat(row.final_score) >= 0.22);

  if (filteredResults.length > 0) {
    const topResult = filteredResults[0];
    console.log(`[SEARCH] Top result: "${topResult.title}" - keyword: ${parseFloat(topResult.keyword_score || 0).toFixed(3)}, vector: ${parseFloat(topResult.vector_similarity || 0).toFixed(3)}, final: ${parseFloat(topResult.final_score || 0).toFixed(3)}`);
  }

  return {
    mode: 'direct',
    query_original: query,
    query_english: searchQuery,
    language_detected: language,
    total_matches: filteredResults.length,
    results: filteredResults.map(row => ({
      session: formatSession(row),
      relevance_score: parseFloat(row.final_score).toFixed(3),
      match_type: parseFloat(row.keyword_score || 0) > 0 ? 'keyword' : 'semantic'
    }))
  };
}

/**
 * Mode A: Smart Hybrid Search
 * LLM parses query, SQL filters, then vector search on filtered results
 */
export async function searchSessionsSmart(ragDb, query, options = {}) {
  const { limit = 20 } = options;

  // Detect language
  const language = detectLanguage(query);

  // Translate if Arabic
  const searchQuery = language === 'arabic'
    ? await translateToEnglish(query)
    : query;

  // Parse query to extract structured filters
  const parsedQuery = await parseQuery(searchQuery);
  console.log('Parsed query filters:', JSON.stringify(parsedQuery));

  // Build SQL filters
  const { whereClause, params } = buildSQLFilters(parsedQuery);
  console.log('SQL WHERE clause:', whereClause);
  console.log('SQL params:', params);

  // Generate embedding for topic (semantic part)
  const topicToEmbed = parsedQuery.topic || searchQuery;
  const queryEmbedding = await generateEmbedding(topicToEmbed);

  // Combined query: SQL filters + vector ranking
  const embeddingParam = `[${queryEmbedding.join(',')}]`;
  const allParams = [...params, embeddingParam, limit];

  let result = await ragDb.query(`
    SELECT
      s.*,
      se.searchable_text,
      1 - (se.embedding <=> $${params.length + 1}::vector) as similarity
    FROM sessions s
    JOIN session_embeddings se ON s.id = se.session_id
    ${whereClause}
    ORDER BY se.embedding <=> $${params.length + 1}::vector
    LIMIT $${params.length + 2}
  `, allParams);

  console.log(`Smart search found ${result.rows.length} results with filters`);

  // FALLBACK: If too few results with filters, try without SQL filters
  if (result.rows.length < 5 && whereClause) {
    console.log('Too few results, falling back to pure vector search');
    const fallbackResult = await ragDb.query(`
      SELECT
        s.*,
        se.searchable_text,
        1 - (se.embedding <=> $1::vector) as similarity
      FROM sessions s
      JOIN session_embeddings se ON s.id = se.session_id
      ORDER BY se.embedding <=> $1::vector
      LIMIT $2
    `, [embeddingParam, limit]);

    // Merge: filtered results first, then fallback results (deduplicated)
    const seenIds = new Set(result.rows.map(r => r.id));
    const additionalRows = fallbackResult.rows.filter(r => !seenIds.has(r.id));
    result.rows = [...result.rows, ...additionalRows].slice(0, limit);
    console.log(`After fallback: ${result.rows.length} total results`);
  }

  return {
    mode: 'smart',
    query_original: query,
    query_english: searchQuery,
    language_detected: language,
    parsed_filters: parsedQuery,
    total_matches: result.rows.length,
    results: result.rows.map(row => ({
      session: formatSession(row),
      relevance_score: parseFloat(row.similarity).toFixed(3)
    }))
  };
}

/**
 * Generate AI reasoning for selected sessions
 * @param {object} ragDb - Database connection
 * @param {string} query - User's original query
 * @param {array} sessions - Sessions to generate reasoning for
 */
export async function generateReasoning(ragDb, query, sessions) {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Check reasoning mode - if embedding_only, skip LLM call
  const reasoningMode = await getReasoningMode(ragDb);
  if (reasoningMode === 'embedding_only') {
    return sessions.map(s => ({
      ...s,
      reasoning: null // No AI reasoning in embedding-only mode
    }));
  }

  // Get the configured LLM model (grok-fast or grok-reasoning)
  const grokModel = await getLlmModel(ragDb) || 'grok-fast';

  const sessionSummaries = sessions.map((s, i) => {
    const session = s.session || s;
    const desc = session.description_english || session.description || '';
    return `${i + 1}. Title: "${session.title}"
   Speaker: ${session.speakers || 'Unknown'}
   Time: ${session.time_start} - ${session.time_end}
   Track: ${session.track || 'General'}
   Description: ${desc.substring(0, 300)}`;
  }).join('\n\n');

  const systemPrompt = `You are a helpful conference assistant. Your job is to explain WHY each session would be valuable for the attendee based on their specific question or interest.

IMPORTANT RULES:
- DO NOT just repeat the session title or speaker name
- DO explain how the session content connects to what the user asked
- Be specific about what the attendee will learn or gain
- Keep each explanation to 1-2 sentences
- If the session is in Arabic, mention that`;

  const userPrompt = `The attendee's question: "${query}"

Sessions found:

${sessionSummaries}

For EACH session, write a brief explanation of WHY it's relevant to the attendee's question. Focus on the VALUE and CONNECTION to their interest, not just restating the title.

Format your response as:
1. [Your explanation for session 1]
2. [Your explanation for session 2]
...`;

  try {
    console.log(`[REASONING] Making LLM call to generate reasoning for ${sessions.length} sessions...`);
    const response = await generateCompletion(userPrompt, {
      model: grokModel,
      systemPrompt,
      maxTokens: 1200,
      temperature: 0.5
    });

    // Parse reasoning into array
    const reasonings = parseReasoningResponse(response, sessions.length);

    return sessions.map((s, i) => ({
      ...s,
      reasoning: reasonings[i] || 'This session matches your search criteria.'
    }));

  } catch (err) {
    console.error('Reasoning generation failed:', err.message);
    // Return sessions with default reasoning
    return sessions.map(s => ({
      ...s,
      reasoning: 'This session matches your search criteria.'
    }));
  }
}

function parseReasoningResponse(text, count) {
  const reasonings = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (let i = 1; i <= count; i++) {
    // Look for lines starting with the number
    const pattern = new RegExp(`^${i}[.):\\s]`, 'i');
    const line = lines.find(l => pattern.test(l.trim()));

    if (line) {
      // Remove the number prefix
      const cleaned = line.replace(/^\d+[.):\s]+/, '').trim();
      reasonings.push(cleaned);
    } else {
      reasonings.push(null);
    }
  }

  return reasonings;
}

function formatSession(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time_start: row.time_start,
    time_end: row.time_end,
    track: row.track,
    room: row.room,
    speakers: row.speakers,
    description: row.description_english || row.description_original,
    description_preview: (row.description_english || row.description_original || '').substring(0, 200),
    session_type: row.session_type,
    tags: row.tags
  };
}

/**
 * Get all sessions for browsing
 */
export async function getAllSessions(ragDb, options = {}) {
  const { date, track, limit = 100 } = options;

  let query = 'SELECT * FROM sessions';
  const params = [];
  const conditions = [];

  if (date) {
    params.push(date);
    conditions.push(`date = $${params.length}`);
  }

  if (track) {
    params.push(`%${track}%`);
    conditions.push(`track ILIKE $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date, time_start';
  params.push(limit);
  query += ` LIMIT $${params.length}`;

  const result = await ragDb.query(query, params);

  return result.rows.map(formatSession);
}

/**
 * Get a single session by ID
 */
export async function getSessionById(ragDb, sessionId) {
  const result = await ragDb.query(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatSession(result.rows[0]);
}

/**
 * Log a search query for analytics
 */
export async function logQuery(ragDb, userId, queryData) {
  const {
    query_original,
    query_english,
    language_detected,
    results_count,
    search_mode,
    user_role,
    // Analytics fields
    ip_address,
    user_agent,
    device_type,
    browser,
    os,
    country,
    city,
    region,
    referer,
    session_id
  } = queryData;

  await ragDb.query(`
    INSERT INTO query_logs (
      visitor_id, user_role, query_original, query_english, detected_language, results_count, search_mode,
      ip_address, user_agent, device_type, browser, os, country, city, region, referer, session_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, [
    userId, user_role, query_original, query_english, language_detected, results_count, search_mode,
    ip_address, user_agent, device_type, browser, os, country, city, region, referer, session_id
  ]);
}
