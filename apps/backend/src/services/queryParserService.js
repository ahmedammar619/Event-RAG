/**
 * Query Parser Service - Extracts structured filters from natural language queries
 * Used by Mode A (Smart Hybrid Search)
 */

import { generateCompletion, extractJSON } from './llmService.js';

const PARSE_SYSTEM_PROMPT = `You are a query parser for a conference session finder. Extract structured information from user queries and return ONLY valid JSON.

Available speakers include: Dr. Haifaa Younis, Yaser Birjas, Suhaib Webb, Zaynab Ansari, Omar Suleiman, and others.
Available tracks include: English Knowledge Retreat, Arabic Knowledge Retreat, Youth Track, Sisters Track, and similar.`;

const PARSE_USER_PROMPT = `Parse this query and return ONLY a JSON object with these fields:
- topic: The main subject/theme (string or null)
- speakers: Array of speaker names mentioned (empty array if none)
- track: The track/category if mentioned (string or null)
- time_preference: One of "morning" (before 12pm), "afternoon" (12-5pm), "evening" (after 5pm), or null
- language_preference: "arabic" or "english" or null

Query: "{query}"

Return only the JSON object:`;

export async function parseQuery(query) {
  if (!query || query.trim().length === 0) {
    return getDefaultParsedQuery();
  }

  const prompt = PARSE_USER_PROMPT.replace('{query}', query.trim());

  try {
    const response = await generateCompletion(prompt, {
      model: 'grok-fast',
      systemPrompt: PARSE_SYSTEM_PROMPT,
      maxTokens: 200,
      temperature: 0.3
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
    time_preference: ['morning', 'afternoon', 'evening'].includes(parsed.time_preference) ? parsed.time_preference : null,
    language_preference: ['arabic', 'english'].includes(parsed.language_preference) ? parsed.language_preference : null
  };
}

function getDefaultParsedQuery(query = '') {
  return {
    topic: query || null,
    speakers: [],
    track: null,
    time_preference: null,
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

  // Time preference filter
  if (parsedQuery.time_preference) {
    switch (parsedQuery.time_preference) {
      case 'morning':
        conditions.push(`s.time_start < '12:00:00'`);
        break;
      case 'afternoon':
        conditions.push(`s.time_start >= '12:00:00' AND s.time_start < '17:00:00'`);
        break;
      case 'evening':
        conditions.push(`s.time_start >= '17:00:00'`);
        break;
    }
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

export async function testQueryParser() {
  const testQuery = "I'm a convert looking for morning sessions about spirituality";

  try {
    const result = await parseQuery(testQuery);
    return {
      testQuery,
      parsedResult: result,
      status: result.topic ? 'ok' : 'partial'
    };
  } catch (err) {
    return {
      testQuery,
      status: 'error',
      error: err.message
    };
  }
}
