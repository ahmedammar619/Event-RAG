/**
 * LLM Service - Centralized service for Grok API calls
 * Uses xAI's Grok API for text generation
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_API_KEY = process.env.XAI_API_KEY;

// Available models
const MODELS = {
  'grok-fast': 'grok-4-1-fast-non-reasoning',     // Fast, no chain-of-thought - Best for parsing
  'grok-reasoning': 'grok-4-1-fast-reasoning'     // Fast with reasoning - Better explanations
};

/**
 * Generate text completion using Grok API
 * @param {string} prompt - The prompt to send
 * @param {object} options - Configuration options
 * @returns {Promise<string>} - Generated text
 */
export async function generateCompletion(prompt, options = {}) {
  const {
    model = 'grok-fast',
    maxTokens = 500,
    temperature = 0.7,
    systemPrompt = null
  } = options;

  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const modelId = MODELS[model] || MODELS['grok-fast'];

  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Grok API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';

  } catch (err) {
    console.error('LLM generation failed:', err.message);
    throw err;
  }
}

/**
 * Parse JSON from LLM response
 * @param {string} text - Text that may contain JSON
 * @returns {object|null} - Parsed JSON or null
 */
export function extractJSON(text) {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Invalid JSON
    }
  }
  return null;
}

/**
 * Test the LLM service connection
 * @returns {Promise<object>} - Test result
 */
export async function testLLMService() {
  try {
    if (!XAI_API_KEY) {
      return { status: 'error', error: 'XAI_API_KEY not configured' };
    }

    const response = await generateCompletion('Say "ok" if you can hear me.', {
      maxTokens: 10,
      temperature: 0
    });

    return {
      status: 'ok',
      model: MODELS['grok-fast'],
      testResponse: response.substring(0, 50)
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export { MODELS };
