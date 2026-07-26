import { rateLimit } from '../utils/rateLimit'
import { withRetry } from '../utils/retry'

const BASE = 'https://api.groq.com/openai/v1'
const RATE_LIMIT_KEY = 'groq-api'
const MAX_PER_MINUTE = 28 // Stay under Groq's 30 req/min free tier

async function callGroq(
  apiKey: string,
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number; model?: string },
): Promise<string> {
  if (!apiKey) throw new Error('No API key configured. Go to Settings to add your Groq API key.')

  // Rate limit check
  const limit = rateLimit(RATE_LIMIT_KEY, MAX_PER_MINUTE)
  if (!limit.allowed) {
    await new Promise(r => setTimeout(r, limit.waitMs))
  }

  return withRetry(async () => {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
  }, { maxRetries: 2, baseDelayMs: 1500 })
}

export async function analyzeReel(
  apiKey: string,
  transcript: string,
  metadata: { creator?: string; caption?: string; hashtags?: string[]; title?: string },
): Promise<{
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  concepts: { name: string; type: string }[]
  language: string
  actionItems: string[]
  entities: { name: string; type: string }[]
  contentCategory: string
  sentiment: string
  targetAudience: string
}> {
  const raw = await callGroq(apiKey, [
    {
      role: 'system',
      content: `You are an expert content analyst for Instagram Reels. Analyze transcripts deeply and extract structured data. Always respond with valid JSON only, no markdown.`,
    },
    {
      role: 'user',
      content: `Analyze this Instagram Reel deeply:

TRANSCRIPT:
${transcript.slice(0, 6000)}

METADATA:
- Creator: ${metadata.creator || 'Unknown'}
- Title: ${metadata.title || 'None'}
- Caption: ${metadata.caption || 'None'}
- Hashtags: ${metadata.hashtags?.join(', ') || 'None'}

Extract ALL of the following:
1. SUMMARY: 1-3 concise sentences capturing the core message
2. KEY TAKEAWAYS: Specific, actionable takeaways (not generic)
3. TAGS: Lowercase tags for categorization
4. CONCEPTS: Named concepts with types (topic, skill, person, brand, tool, framework, trend)
5. ENTITIES: Specific named items mentioned (books, products, tools, people, places, apps, courses, etc.)
   - If the reel says "here are 5 books to read", list each book name
   - If the reel mentions specific products, list each product
   - If the reel mentions people, list each person
   - Type can be: book, product, tool, person, place, app, course, website, brand, other
6. CONTENT CATEGORY: primary category (educational, entertainment, motivational, instructional, review, storytelling, news, other)
7. SENTIMENT: overall tone (positive, negative, neutral, mixed)
8. TARGET AUDIENCE: who is this content for (e.g., "fitness beginners", "small business owners", "students")
9. ACTION ITEMS: specific steps the viewer can take (if instructional)

Respond with ONLY this JSON:
{
  "summary": "1-3 concise sentences",
  "keyTakeaways": ["specific takeaway 1", "takeaway 2"],
  "suggestedTags": ["lowercase-tag1", "tag2"],
  "concepts": [{"name": "concept name", "type": "topic|skill|person|brand|tool|framework|trend"}],
  "language": "en",
  "actionItems": ["actionable step 1"],
  "entities": [{"name": "entity name", "type": "book|product|tool|person|place|app|course|website|brand|other"}],
  "contentCategory": "educational|entertainment|motivational|instructional|review|storytelling|news|other",
  "sentiment": "positive|negative|neutral|mixed",
  "targetAudience": "description of target audience"
}`,
    },
  ], { temperature: 0.2, max_tokens: 2000 })

  try {
    const parsed = JSON.parse(raw)
    return {
      summary: parsed.summary || '',
      keyTakeaways: parsed.keyTakeaways || [],
      suggestedTags: parsed.suggestedTags || [],
      concepts: parsed.concepts || [],
      language: parsed.language || 'en',
      actionItems: parsed.actionItems || [],
      entities: parsed.entities || [],
      contentCategory: parsed.contentCategory || 'other',
      sentiment: parsed.sentiment || 'neutral',
      targetAudience: parsed.targetAudience || '',
    }
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return {
          summary: parsed.summary || '',
          keyTakeaways: parsed.keyTakeaways || [],
          suggestedTags: parsed.suggestedTags || [],
          concepts: parsed.concepts || [],
          language: parsed.language || 'en',
          actionItems: parsed.actionItems || [],
          entities: parsed.entities || [],
          contentCategory: parsed.contentCategory || 'other',
          sentiment: parsed.sentiment || 'neutral',
          targetAudience: parsed.targetAudience || '',
        }
      } catch { /* fall through */ }
    }
    return {
      summary: transcript.slice(0, 200),
      keyTakeaways: [],
      suggestedTags: [],
      concepts: [],
      language: 'en',
      actionItems: [],
      entities: [],
      contentCategory: 'other',
      sentiment: 'neutral',
      targetAudience: '',
    }
  }
}

export async function chatWithLibrary(
  apiKey: string,
  question: string,
  context: { reelNumber?: number; title: string; creator?: string; summary: string; transcript: string; tags: string[]; entities?: string; actionItems?: string[]; topComments?: string }[],
): Promise<string> {
  const contextStr = context.map((r, i) => {
    const num = r.reelNumber || i + 1
    const parts = [
      `REEL ${num}: "${r.title}" by @${r.creator || 'unknown'}`,
      r.tags.length > 0 ? `Tags: ${r.tags.join(', ')}` : null,
      r.entities ? `Entities: ${r.entities}` : null,
      r.summary ? `Summary: ${r.summary}` : null,
      r.transcript ? `Transcript excerpt: ${r.transcript.slice(0, 800)}` : null,
      r.actionItems && r.actionItems.length > 0 ? `Action Items: ${r.actionItems.join('; ')}` : null,
      r.topComments && r.topComments.length > 0 ? `Top Comments:\n${r.topComments}` : null,
    ].filter(Boolean)
    return parts.join('\n')
  }).join('\n\n---\n\n')

  return callGroq(apiKey, [
    {
      role: 'system',
      content: `You are a helpful assistant that answers questions based on a user's saved Instagram Reel library. Use ONLY the provided Reels as your knowledge base. Always cite which Reel(s) you're referencing by number and creator handle (e.g., "Reel 3 by @creator"). If the library doesn't contain relevant information, say so clearly. Format citations inline like [Reel N: "title" by @creator].`,
    },
    {
      role: 'user',
      content: `MY REEL LIBRARY:\n\n${contextStr}\n\n---\n\nQUESTION: ${question}`,
    },
  ], { temperature: 0.3, max_tokens: 2000 })
}

export async function extractMetadataFromText(
  apiKey: string,
  url: string,
  pageText: string,
): Promise<{
  title: string
  creator: string
  caption: string
  hashtags: string[]
  description: string
}> {
  const raw = await callGroq(apiKey, [
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
