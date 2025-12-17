/**
 * AI Settings Service - Manage AI configuration settings
 */

export async function getSetting(ragDb, key) {
  const result = await ragDb.query(
    'SELECT value FROM ai_settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].value;
}

export async function getAllSettings(ragDb) {
  const result = await ragDb.query(
    'SELECT key, value, updated_at FROM ai_settings ORDER BY key'
  );

  return result.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function updateSetting(ragDb, key, value) {
  const result = await ragDb.query(`
    INSERT INTO ai_settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    RETURNING *
  `, [key, value]);

  return result.rows[0];
}

export async function getSearchMode(ragDb) {
  const mode = await getSetting(ragDb, 'search_mode');
  return mode || 'direct'; // Default to 'direct' (Mode B)
}

export async function setSearchMode(ragDb, mode) {
  if (!['direct', 'smart'].includes(mode)) {
    throw new Error('Invalid search mode. Must be "direct" or "smart"');
  }

  return await updateSetting(ragDb, 'search_mode', mode);
}

export async function getDefaultResultCount(ragDb) {
  const count = await getSetting(ragDb, 'default_result_count');
  return parseInt(count) || 5;
}

export async function setDefaultResultCount(ragDb, count) {
  const num = parseInt(count);
  if (isNaN(num) || num < 1 || num > 50) {
    throw new Error('Invalid result count. Must be between 1 and 50');
  }

  return await updateSetting(ragDb, 'default_result_count', num.toString());
}

// LLM Model setting
export async function getLlmModel(ragDb) {
  const model = await getSetting(ragDb, 'llm_model');
  // Map old model names to new ones, default to grok-fast
  if (model === 'gemma3:270m' || model === 'gemma3-4b' || !model) {
    return 'grok-fast';
  }
  return model;
}

export async function setLlmModel(ragDb, model) {
  const validModels = ['grok-fast', 'grok-reasoning'];
  if (!validModels.includes(model)) {
    throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
  }

  return await updateSetting(ragDb, 'llm_model', model);
}

// Reasoning mode setting
export async function getReasoningMode(ragDb) {
  const mode = await getSetting(ragDb, 'reasoning_mode');
  return mode || 'full';
}

export async function setReasoningMode(ragDb, mode) {
  const validModes = ['full', 'embedding_only'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid reasoning mode. Must be one of: ${validModes.join(', ')}`);
  }

  return await updateSetting(ragDb, 'reasoning_mode', mode);
}
