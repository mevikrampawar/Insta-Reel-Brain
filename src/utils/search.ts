import type { Reel, SearchResult } from '../types'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2 }
  const d = Math.sqrt(normA) * Math.sqrt(normB)
  return d > 0 ? dot / d : 0
}

export function keywordSearch(reels: Reel[], q: string): SearchResult[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return reels
    .filter(r => r.ingestStatus === 'complete')
    .map(reel => {
      const hay = [reel.title, reel.caption, reel.summary, reel.transcript, reel.creatorHandle, ...reel.suggestedTags, ...reel.keyTakeaways]
        .filter(Boolean).join(' ').toLowerCase()
      let score = 0
      for (const t of terms) { const m = hay.match(new RegExp(t, 'gi')); if (m) score += m.length / terms.length }
      const snippet = (() => { const i = hay.indexOf(terms[0]); if (i < 0) return hay.slice(0, 120); const s = Math.max(0, i - 50); return (s > 0 ? '...' : '') + hay.slice(s, s + 120) + '...' })()
      return { reel, score, matchType: 'keyword' as const, snippet }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function semanticSearch(reels: Reel[], emb: number[]): SearchResult[] {
  return reels
    .filter(r => r.ingestStatus === 'complete' && r.embedding?.length > 0)
    .map(r => ({ reel: r, score: cosineSimilarity(r.embedding, emb), matchType: 'semantic' as const, snippet: r.summary?.slice(0, 150) || '' }))
    .filter(r => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
}

export function combinedSearch(reels: Reel[], q: string, emb: number[]): SearchResult[] {
  const kw = keywordSearch(reels, q), sm = semanticSearch(reels, emb)
  const map = new Map<string, SearchResult>()
  for (const r of kw) map.set(r.reel.id, { ...r, score: r.score * 0.4 })
  for (const r of sm) {
    const ex = map.get(r.reel.id)
    if (ex) { ex.score += r.score * 0.6; ex.matchType = 'combined' }
    else map.set(r.reel.id, { ...r, score: r.score * 0.6 })
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score)
}
