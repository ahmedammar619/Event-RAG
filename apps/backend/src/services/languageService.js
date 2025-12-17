/**
 * Language Service - Detect language and translate text
 */

import { franc } from 'franc-min';

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL;
const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ollama-production-2290.up.railway.app';

// Arabic Unicode range regex
const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsArabic(text) {
  return arabicRegex.test(text);
}

export function detectLanguage(text) {
  if (!text || text.trim().length === 0) {
    return 'english';
  }

  // Quick check for Arabic characters
  if (containsArabic(text)) {
    return 'arabic';
  }

  // Use franc for more accurate detection
  const lang = franc(text);

  // franc returns 'arb' for Arabic, 'eng' for English
  if (lang === 'arb' || lang === 'ara') {
    return 'arabic';
  }

  return 'english';
}

async function translateWithLibreTranslate(text, source = 'ar', target = 'en') {
  if (!LIBRETRANSLATE_URL) {
    throw new Error('LibreTranslate URL not configured');
  }

  const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`LibreTranslate error: ${response.status}`);
  }

  const data = await response.json();
  return data.translatedText;
}

async function translateWithOllama(text, targetLanguage = 'English') {
  const prompt = `Translate the following text to ${targetLanguage}. Only provide the translation, nothing else:

${text}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3:270m',
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return data.response?.trim() || text;
}

export async function translateToEnglish(text) {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // If no Arabic content, return as-is
  if (!containsArabic(text)) {
    return text;
  }

  // Try LibreTranslate first, fall back to Ollama
  if (LIBRETRANSLATE_URL) {
    try {
      return await translateWithLibreTranslate(text, 'ar', 'en');
    } catch (err) {
      console.log('LibreTranslate failed, falling back to Ollama:', err.message);
    }
  }

  return await translateWithOllama(text, 'English');
}

export async function translateToArabic(text) {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Try LibreTranslate first, fall back to Ollama
  if (LIBRETRANSLATE_URL) {
    try {
      return await translateWithLibreTranslate(text, 'en', 'ar');
    } catch (err) {
      console.log('LibreTranslate failed, falling back to Ollama:', err.message);
    }
  }

  return await translateWithOllama(text, 'Arabic');
}

export async function testLanguageService() {
  const testArabic = 'مرحبا بالعالم';
  const testEnglish = 'Hello world';

  return {
    arabicDetection: detectLanguage(testArabic) === 'arabic' ? 'ok' : 'fail',
    englishDetection: detectLanguage(testEnglish) === 'english' ? 'ok' : 'fail',
    libreTranslateConfigured: !!LIBRETRANSLATE_URL,
    ollamaUrl: OLLAMA_URL
  };
}
