import { GROQ_API_KEY } from '../firebase-config'

const BASE = 'https://api.groq.com/openai/v1'

async function callGroq(
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number; model?: string },
): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured. Add VITE_GROQ_API_KEY to .env')
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: opts?.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.max_tokens ?? 2048,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Groq API error ${res.status}: ${err.error?.message || res.statusText}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function analyzeReel(
  transcript: string,
  metadata: { creator?: string; caption?: string; hashtags?: string[]; title?: string },
): Promise<{
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  concepts: { name: string; type: string }[]
  language: string
  actionItems: string[]
}> {
  const raw = await callGroq([
    {
      role: 'system',
      content: `You are an expert content analyst for Instagram Reels. Analyze transcripts and extract structured data. Always respond with valid JSON only, no markdown.`,
    },
    {
      role: 'user',
      content: `Analyze this Instagram Reel:

TRANSCRIPT:
${transcript.slice(0, 6000)}

METADATA:
- Creator: ${metadata.creator || 'Unknown'}
- Title: ${metadata.title || 'None'}
- Caption: ${metadata.caption || 'None'}
- Hashtags: ${metadata.hashtags?.join(', ') || 'None'}

Respond with ONLY this JSON:
{
  "summary": "1-3 concise sentences capturing the core message",
  "keyTakeaways": ["specific takeaway 1", "takeaway 2", "takeaway 3"],
  "suggestedTags": ["lowercase-tag1", "tag2"],
  "concepts": [{"name": "concept name", "type": "topic|skill|person|brand|tool|framework|trend"}],
  "language": "en",
  "actionItems": ["actionable step 1 if instructional"]
}`,
    },
  ], { temperature: 0.2, max_tokens: 1500 })

  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return {
      summary: transcript.slice(0, 200),
      keyTakeaways: [],
      suggestedTags: [],
      concepts: [],
      language: 'en',
      actionItems: [],
    }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const raw = await callGroq([
    {
      role: 'system',
      content: 'Generate semantic embedding vectors. Respond with ONLY 64 comma-separated decimal numbers between -1 and 1. Nothing else.',
    },
    {
      role: 'user',
      content: `Generate embedding for: ${text.slice(0, 3000)}`,
    },
  ], { temperature: 0, max_tokens: 300, model: 'llama-3.3-70b-versatile' })

  const numbers = raw.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n))
  const vector = new Array(64).fill(0).map((_, i) => numbers[i] || 0)
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
  return norm > 0 ? vector.map(v => v / norm) : vector
}

export async function searchQueryToEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query)
}

export async function chatWithLibrary(
  question: string,
  context: { title: string; summary: string; transcript: string; tags: string[] }[],
): Promise<string> {
  const contextStr = context.map((r, i) =>
    `REEL ${i + 1}: "${r.title}"\nTags: ${r.tags.join(', ')}\nSummary: ${r.summary}\nTranscript excerpt: ${r.transcript.slice(0, 800)}`
  ).join('\n\n---\n\n')

  return callGroq([
    {
      role: 'system',
      content: `You are a helpful assistant that answers questions based on a user's saved Instagram Reel library. Use ONLY the provided Reels as your knowledge base. Always cite which Reel(s) you're referencing by number. If the library doesn't contain relevant information, say so clearly.`,
    },
    {
      role: 'user',
      content: `MY REEL LIBRARY:\n\n${contextStr}\n\n---\n\nQUESTION: ${question}`,
    },
  ], { temperature: 0.3, max_tokens: 2000 })
}

export async function extractMetadataFromText(
  url: string,
  pageText: string,
): Promise<{
  title: string
  creator: string
  caption: string
  hashtags: string[]
  description: string
}> {
  const raw = await callGroq([
    {
      role: 'system',
      content: 'Extract Instagram Reel metadata from page text. Respond with valid JSON only.',
    },
    {
      role: 'user',
      content: `Extract metadata from this Instagram Reel page text. URL: ${url}

PAGE TEXT:
${pageText.slice(0, 4000)}

Respond with ONLY this JSON:
{
  "title": "Reel title or first line of caption",
  "creator": "username without @",
  "caption": "full caption text",
  "hashtags": ["hashtag1", "hashtag2"],
  "description": "brief description of the content"
}`,
    },
  ], { temperature: 0.1, max_tokens: 1000 })

  try { return JSON.parse(raw) }
  catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { title: '', creator: '', caption: '', hashtags: [], description: '' }
  }
}
