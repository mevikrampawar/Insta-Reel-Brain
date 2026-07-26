import { rateLimit } from '../utils/rateLimit'
import { withRetry } from '../utils/retry'
import { MAJOR_CATEGORIES } from '../utils/constants'

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

function parseJsonFromLLMResponse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) as T } catch { /* fall through */ }
    }
    return fallback
  }
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

  const fallback = {
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

  return parseJsonFromLLMResponse(raw, fallback)
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

export async function classifyReelCategory(
  apiKey: string,
  summary: string,
  tags: string[],
  entities: { name: string; type: string }[],
  contentCategory: string,
): Promise<string> {
  const raw = await callGroq(apiKey, [
    {
      role: 'system',
      content: `You are a content classifier. Classify content into exactly ONE of these categories: ${MAJOR_CATEGORIES.join(', ')}. Respond with ONLY the category name, nothing else.`,
    },
    {
      role: 'user',
      content: `Classify this content into exactly ONE category.

Summary: ${summary.slice(0, 500)}
Tags: ${tags.slice(0, 10).join(', ')}
Entities: ${entities.slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ')}
Content type: ${contentCategory}

Respond with ONLY one of: ${MAJOR_CATEGORIES.join(', ')}`,
    },
  ], { temperature: 0.1, max_tokens: 50 })

  const cleaned = raw.trim().replace(/^["']|["']$/g, '')
  if (MAJOR_CATEGORIES.includes(cleaned as typeof MAJOR_CATEGORIES[number])) {
    return cleaned
  }
  // Fallback: find closest match
  const lower = cleaned.toLowerCase()
  for (const cat of MAJOR_CATEGORIES) {
    if (cat.toLowerCase().includes(lower) || lower.includes(cat.toLowerCase().split(' ')[0])) {
      return cat
    }
  }
  return 'Education & Learning'
}

export async function classifyReelHierarchy(
  apiKey: string,
  summary: string,
  tags: string[],
  entities: { name: string; type: string }[],
  contentCategory: string,
): Promise<string[]> {
  const raw = await callGroq(apiKey, [
    {
      role: 'system',
      content: `You are a content taxonomy classifier. Assign a hierarchical category path to content. The first level MUST be exactly one of: ${MAJOR_CATEGORIES.join(', ')}. Subsequent levels are specific sub-categories you determine based on the content. Return 2-3 levels total. Respond with valid JSON only.`,
    },
    {
      role: 'user',
      content: `Classify this content into a hierarchical category path (2-3 levels).

Summary: ${summary.slice(0, 500)}
Tags: ${tags.slice(0, 10).join(', ')}
Entities: ${entities.slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ')}
Content type: ${contentCategory}

Rules:
- First element MUST be one of: ${MAJOR_CATEGORIES.join(', ')}
- Second element is a sub-category (e.g., "Coding", "Weight Training", "Stock Market")
- Third element (optional) is a more specific topic (e.g., "React", "Python", "HIIT")
- Keep it concise — each level is 1-3 words max

Respond with ONLY this JSON:
{
  "categoryPath": ["Major Category", "Sub-Category", "Specific Topic"]
}`,
    },
  ], { temperature: 0.2, max_tokens: 150 })

  const parsed = parseJsonFromLLMResponse<{ categoryPath?: string[] }>(raw, {})
  if (Array.isArray(parsed.categoryPath) && parsed.categoryPath.length >= 2) {
    const path = parsed.categoryPath.map(s => String(s).trim()).filter(Boolean)
    if (path.length >= 2 && MAJOR_CATEGORIES.includes(path[0] as typeof MAJOR_CATEGORIES[number])) {
      return path.slice(0, 3)
    }
  }
  // Fallback: use flat classifier then append generic sub-category
  const flat = await classifyReelCategory(apiKey, summary, tags, entities, contentCategory)
  return [flat, 'General']
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

  return parseJsonFromLLMResponse(raw, { title: '', creator: '', caption: '', hashtags: [], description: '' })
}
