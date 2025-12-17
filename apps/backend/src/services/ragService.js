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

  if (mode === 'smart') {
    return await searchSessionsSmart(ragDb, query, options);
  } else {
    return await searchSessionsDirect(ragDb, query, options);
  }
}

/**
 * Mode B: Direct Vector Search
 * Fast, no LLM parsing, pure semantic search
 */
export async function searchSessionsDirect(ragDb, query, options = {}) {
  const { limit = 20 } = options;

  // Detect language
  const language = detectLanguage(query);

  // Translate if Arabic
  const searchQuery = language === 'arabic'
    ? await translateToEnglish(query)
    : query;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(searchQuery);

  // Vector search
  const result = await ragDb.query(`
    SELECT
      s.*,
      se.searchable_text,
      1 - (se.embedding <=> $1::vector) as similarity
    FROM session_embeddings se
    JOIN sessions s ON s.id = se.session_id
    ORDER BY se.embedding <=> $1::vector
    LIMIT $2
  `, [`[${queryEmbedding.join(',')}]`, limit]);

  return {
    mode: 'direct',
    query_original: query,
    query_english: searchQuery,
    language_detected: language,
    total_matches: result.rows.length,
    results: result.rows.map(row => ({
      session: formatSession(row),
      relevance_score: parseFloat(row.similarity).toFixed(3)
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
