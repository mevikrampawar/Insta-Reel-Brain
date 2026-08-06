const BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const MAJOR_CATEGORIES = [
  'AI & Technology',
  'Fitness & Health',
  'Business & Marketing',
  'Programming & Development',
  'Productivity & Self-improvement',
  'Finance & Investing',
  'Creative & Design',
  'Education & Learning',
  'Lifestyle & Entertainment',
  'Food & Cooking',
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function callGroq(env, messages, opts = {}) {
  const apiKey = env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  let lastError = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt)
    let res
    try {
      res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model || DEFAULT_MODEL,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.max_tokens ?? 2048,
        }),
      })
    } catch (e) {
      lastError = e
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Groq API error ${res.status}`)
      continue
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Groq API error ${res.status}: ${err.error?.message || res.statusText}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }
  throw lastError || new Error('Groq API request failed')
}

function parseJsonFromLLMResponse(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* fall through */ }
    }
    return fallback
  }
}

function validateAnalysis(raw) {
  const out = { ...raw }
  if (typeof out.summary !== 'string') out.summary = ''
  for (const key of ['keyTakeaways', 'suggestedTags', 'actionItems']) {
    if (!Array.isArray(out[key])) out[key] = []
  }
  if (!Array.isArray(out.concepts)) out.concepts = []
  else out.concepts = out.concepts.filter(c => c && typeof c === 'object' && typeof c.name === 'string')
  if (!Array.isArray(out.entities)) out.entities = []
  else out.entities = out.entities.filter(e => e && typeof e === 'object' && typeof e.name === 'string')
  if (typeof out.language !== 'string') out.language = 'en'
  if (typeof out.contentCategory !== 'string') out.contentCategory = 'other'
  if (typeof out.sentiment !== 'string') out.sentiment = 'neutral'
  if (typeof out.targetAudience !== 'string') out.targetAudience = ''
  return out
}

export async function analyzeReel(env, transcript, metadata) {
  const raw = await callGroq(env, [
    {
      role: 'system',
      content: 'You are an expert content analyst for Instagram Reels. Analyze transcripts deeply and extract structured data. Always respond with valid JSON only, no markdown.',
    },
    {
      role: 'user',
      content: `Analyze this Instagram Reel deeply:

TRANSCRIPT:
${(transcript || '').slice(0, 6000)}

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
    summary: (transcript || '').slice(0, 200),
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

  return validateAnalysis(parseJsonFromLLMResponse(raw, fallback))
}

export async function classifyReelCategory(env, summary, tags, entities, contentCategory) {
  const raw = await callGroq(env, [
    {
      role: 'system',
      content: `You are a content classifier. Classify content into exactly ONE of these categories: ${MAJOR_CATEGORIES.join(', ')}. Respond with ONLY the category name, nothing else.`,
    },
    {
      role: 'user',
      content: `Classify this content into exactly ONE category.

Summary: ${(summary || '').slice(0, 500)}
Tags: ${(tags || []).slice(0, 10).join(', ')}
Entities: ${(entities || []).slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ')}
Content type: ${contentCategory}

Respond with ONLY one of: ${MAJOR_CATEGORIES.join(', ')}`,
    },
  ], { temperature: 0.1, max_tokens: 50 })

  const cleaned = raw.trim().replace(/^["']|["']$/g, '')
  if (MAJOR_CATEGORIES.includes(cleaned)) return cleaned
  const lower = cleaned.toLowerCase()
  for (const cat of MAJOR_CATEGORIES) {
    if (cat.toLowerCase().includes(lower) || lower.includes(cat.toLowerCase().split(' ')[0])) return cat
  }
  return 'Education & Learning'
}

export async function classifyReelHierarchy(env, summary, tags, entities, contentCategory) {
  const raw = await callGroq(env, [
    {
      role: 'system',
      content: `You are a content taxonomy classifier. Assign a hierarchical category path to content. The first level MUST be exactly one of: ${MAJOR_CATEGORIES.join(', ')}. Subsequent levels are specific sub-categories you determine based on the content. Return 2-3 levels total. Respond with valid JSON only.`,
    },
    {
      role: 'user',
      content: `Classify this content into a hierarchical category path (2-3 levels).

Summary: ${(summary || '').slice(0, 500)}
Tags: ${(tags || []).slice(0, 10).join(', ')}
Entities: ${(entities || []).slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ')}
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

  const parsed = parseJsonFromLLMResponse(raw, {})
  if (Array.isArray(parsed.categoryPath) && parsed.categoryPath.length >= 2) {
    const path = parsed.categoryPath.map(s => String(s).trim()).filter(Boolean)
    if (path.length >= 2 && MAJOR_CATEGORIES.includes(path[0])) return path.slice(0, 3)
  }
  const flat = await classifyReelCategory(env, summary, tags, entities, contentCategory)
  return [flat, 'General']
}

export async function extractMetadataFromText(env, url, pageText) {
  const raw = await callGroq(env, [
    {
      role: 'system',
      content: 'Extract Instagram Reel metadata from page text. Respond with valid JSON only.',
    },
    {
      role: 'user',
      content: `Extract metadata from this Instagram Reel page text. URL: ${url}

PAGE TEXT:
${(pageText || '').slice(0, 4000)}

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
