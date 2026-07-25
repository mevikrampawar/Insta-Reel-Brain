// Lightweight TF-IDF implementation for in-browser text similarity.
// No API calls needed — deterministic, fast, and free.

const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','as','into','through','during',
  'before','after','above','below','between','out','off','over','under','again',
  'further','then','once','here','there','when','where','why','how','all','both',
  'each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','just','don','now','i','me','my','myself','we',
  'our','ours','ourselves','you','your','yours','yourself','yourselves','he','him',
  'his','himself','she','her','hers','herself','it','its','itself','they','them',
  'their','theirs','themselves','what','which','who','whom','this','that','these',
  'those','am','about','up','s','t','re','ve','ll','d','m','instagram','reel',
  'reels','video','watch','like','follow','share','comment','check','link',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
}

export interface TfIdfVector {
  terms: string[]
  values: number[]
}

export interface TfIdfIndex {
  documents: { id: string; vector: TfIdfVector }[]
  idf: Map<string, number>
}

// Compute term frequency for a single document
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1)
  }
  // Normalize by max frequency
  const maxF = Math.max(...tf.values(), 1)
  for (const [k, v] of tf) {
    tf.set(k, v / maxF)
  }
  return tf
}

// Build a TF-IDF index from a collection of documents
export function buildTfIdfIndex(
  docs: { id: string; text: string }[],
): TfIdfIndex {
  const N = docs.length
  const df = new Map<string, number>()
  const docTokens: string[][] = []

  for (const doc of docs) {
    const tokens = tokenize(doc.text)
    docTokens.push(tokens)
    const unique = new Set(tokens)
    for (const t of unique) {
      df.set(t, (df.get(t) || 0) + 1)
    }
  }

  // Compute IDF: log(N / df) with smoothing
  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N + 1) / (freq + 1)) + 1)
  }

  // Build vectors
  const documents = docs.map((doc, i) => {
    const tf = termFrequency(docTokens[i])
    const terms: string[] = []
    const values: number[] = []
    for (const [term, freq] of tf) {
      const idfVal = idf.get(term) || 0
      terms.push(term)
      values.push(freq * idfVal)
    }
    // L2 normalize
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0))
    if (norm > 0) {
      for (let i = 0; i < values.length; i++) values[i] /= norm
    }
    return { id: doc.id, vector: { terms, values } }
  })

  return { documents, idf }
}

// Compute TF-IDF vector for a query text using an existing index
export function queryVector(query: string, idf: Map<string, number>): TfIdfVector {
  const tokens = tokenize(query)
  const tf = termFrequency(tokens)
  const terms: string[] = []
  const values: number[] = []
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term) || 0
    terms.push(term)
    values.push(freq * idfVal)
  }
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < values.length; i++) values[i] /= norm
  }
  return { terms, values }
}

// Cosine similarity between two sparse vectors
function cosineSimilaritySparse(a: TfIdfVector, b: TfIdfVector): number {
  const bMap = new Map<string, number>()
  for (let i = 0; i < b.terms.length; i++) {
    bMap.set(b.terms[i], b.values[i])
  }
  let dot = 0
  for (let i = 0; i < a.terms.length; i++) {
    const bVal = bMap.get(a.terms[i])
    if (bVal !== undefined) {
      dot += a.values[i] * bVal
    }
  }
  return dot
}

// Search: returns doc IDs ranked by TF-IDF similarity
export function tfidfSearch(
  index: TfIdfIndex,
  query: string,
  threshold = 0.05,
): { id: string; score: number }[] {
  const qVec = queryVector(query, index.idf)
  if (qVec.terms.length === 0) return []

  return index.documents
    .map(doc => ({
      id: doc.id,
      score: cosineSimilaritySparse(doc.vector, qVec),
    }))
    .filter(r => r.score > threshold)
    .sort((a, b) => b.score - a.score)
}

// Build text representation from a reel for indexing
export function reelToText(reel: {
  title?: string
  caption?: string
  summary?: string
  transcript?: string
  creatorHandle?: string
  suggestedTags?: string[]
  keyTakeaways?: string[]
}): string {
  return [
    reel.title || '',
    reel.caption || '',
    reel.summary || '',
    reel.transcript || '',
    reel.creatorHandle || '',
    ...(reel.suggestedTags || []),
    ...(reel.keyTakeaways || []),
  ].join(' ')
}
