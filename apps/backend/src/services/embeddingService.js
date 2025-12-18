/**
 * Embedding Service - Generates vector embeddings using nomic-embed-text
 */

const EMBEDDING_URL = process.env.EMBEDDING_URL || 'https://nomic-embed-text-production.up.railway.app';

export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for embedding generation');
  }

  console.log(`[EMBEDDING API] Generating embedding for: "${text.substring(0, 50)}..."`);

  const response = await fetch(`${EMBEDDING_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text-v2-moe',
      input: text.trim()
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Ollama returns embeddings in data.embeddings array (first element)
  const embedding = data.embeddings?.[0] || data.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid embedding response: missing embedding array');
  }

  return embedding;
}

export function testEmbeddingService() {
  // Just check configuration - avoid unnecessary API calls on health checks
  const hasUrl = !!EMBEDDING_URL;
  return {
    status: hasUrl ? 'ok' : 'not_configured',
    configured: hasUrl,
    dimensions: 768, // nomic-embed-text-v2-moe dimensions
    url: EMBEDDING_URL
  };
}
