import { GEMINI_API_KEY } from '../firebase-config'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const res = await fetch(
    `${BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function analyzeReel(
  transcript: string,
  metadata: { creator?: string; caption?: string; hashtags?: string[] },
): Promise<{
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  concepts: { name: string; type: string }[]
  language: string
}> {
  const prompt = `Analyze this Instagram Reel transcript. Respond with ONLY valid JSON.

TRANSCRIPT:
${transcript.slice(0, 4000)}

METADATA:
- Creator: ${metadata.creator || 'Unknown'}
- Caption: ${metadata.caption || 'None'}
- Hashtags: ${metadata.hashtags?.join(', ') || 'None'}

JSON format:
{
  "summary": "1-3 sentence summary",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "suggestedTags": ["tag1", "tag2"],
  "concepts": [{"name": "concept name", "type": "topic|skill|person|brand|tool|framework|trend"}],
  "language": "en"
}

Rules: summary concise. takeaways specific and actionable. tags lowercase no hash. 3-7 concepts.`

  const raw = await callGemini(prompt, 'You are a content analyst. Respond with valid JSON only, no markdown formatting.')
  try {
    return JSON.parse(raw)
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { summary: transcript.slice(0, 200), keyTakeaways: [], suggestedTags: [], concepts: [], language: 'en' }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const prompt = `Generate a semantic embedding vector for this text. Respond with ONLY a comma-separated list of exactly 32 numbers between -1 and 1. No other text.

TEXT:
${text.slice(0, 2000)}`

  const raw = await callGemini(prompt, 'You are an embedding generator. Respond with ONLY numbers, comma-separated. Exactly 32 values.')
  const numbers = raw.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n))
  const vector = new Array(32).fill(0).map((_, i) => numbers[i] || 0)
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
  return norm > 0 ? vector.map(v => v / norm) : vector
}

export async function searchQueryToEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query)
}
