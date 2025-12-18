/**
 * Query Parser Service - Extracts structured filters from natural language queries
 * Used by Mode A (Smart Hybrid Search)
 */

import { generateCompletion, extractJSON } from './llmService.js';

const PARSE_SYSTEM_PROMPT = `You parse queries for an Islamic conference (MASCON). Extract filters as JSON.

Fields:
- topic: main theme/interest (string or null)
- speakers: names mentioned (array)
- track: "Youth", "Sisters", "Arabic", "English" if mentioned (string or null)
- language_preference: "arabic" or "english" ONLY if explicitly stated (string or null)

Return ONLY valid JSON, no explanation.`;

const PARSE_USER_PROMPT = `"{query}"
Extract filters:`;

export async function parseQuery(query) {
  if (!query || query.trim().length === 0) {
    return getDefaultParsedQuery();
  }

  const prompt = PARSE_USER_PROMPT.replace('{query}', query.trim());

  try {
    console.log('[QUERY PARSER] Making LLM call to parse query filters...');
    const response = await generateCompletion(prompt, {
      model: 'grok-fast',
      systemPrompt: PARSE_SYSTEM_PROMPT,
      maxTokens: 150,
      temperature: 0.1
    });

    const parsed = extractJSON(response);

    if (parsed) {
      return normalizeParseResult(parsed);
    }

    // Fallback to default if parsing failed
    console.log('Query parsing failed, using defaults. Response:', response);
    return getDefaultParsedQuery(query);

  } catch (err) {
    console.error('Query parsing error:', err.message);
    return getDefaultParsedQuery(query);
  }
}

function normalizeParseResult(parsed) {
  return {
    topic: typeof parsed.topic === 'string' ? parsed.topic : null,
    speakers: Array.isArray(parsed.speakers) ? parsed.speakers.filter(s => typeof s === 'string') : [],
    track: typeof parsed.track === 'string' ? parsed.track : null,
    language_preference: ['arabic', 'english'].includes(parsed.language_preference) ? parsed.language_preference : null
  };
}

function getDefaultParsedQuery(query = '') {
  return {
    topic: query || null,
    speakers: [],
    track: null,
    language_preference: null
  };
}

export function buildSQLFilters(parsedQuery) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Speaker filter (case-insensitive partial match)
  if (parsedQuery.speakers && parsedQuery.speakers.length > 0) {
    const speakerConditions = parsedQuery.speakers.map(speaker => {
      params.push(`%${speaker}%`);
      return `s.speakers ILIKE $${paramIndex++}`;
    });
    conditions.push(`(${speakerConditions.join(' OR ')})`);
  }

  // Track filter
  if (parsedQuery.track) {
    params.push(`%${parsedQuery.track}%`);
    conditions.push(`s.track ILIKE $${paramIndex++}`);
  }

  // Language preference (based on track name typically)
  if (parsedQuery.language_preference) {
    if (parsedQuery.language_preference === 'arabic') {
      params.push('%Arabic%');
      conditions.push(`s.track ILIKE $${paramIndex++}`);
    } else if (parsedQuery.language_preference === 'english') {
      params.push('%English%');
      conditions.push(`s.track ILIKE $${paramIndex++}`);
    }
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

export function testQueryParser() {
  // Just check if the service is configured - DON'T make actual API calls
  const hasApiKey = !!process.env.XAI_API_KEY;
  return {
    status: hasApiKey ? 'ok' : 'not_configured',
    configured: hasApiKey
  };
}
