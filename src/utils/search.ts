import type { Reel, SearchResult } from '../types'
import { buildTfIdfIndex, tfidfSearch, reelToText } from './tfidf'

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

export function semanticSearch(reels: Reel[], query: string): SearchResult[] {
  const completeReels = reels.filter(r => r.ingestStatus === 'complete')
  if (completeReels.length === 0) return []

  // Build TF-IDF index from reel text
  const docs = completeReels.map(r => ({
    id: r.id,
    text: r.searchableText || reelToText(r),
  }))
  const index = buildTfIdfIndex(docs)

  // Search
  const results = tfidfSearch(index, query, 0.05)

  return results.map(r => {
    const reel = completeReels.find(cr => cr.id === r.id)!
    const snippet = reel.summary?.slice(0, 150) || reel.caption?.slice(0, 150) || ''
    return { reel, score: r.score, matchType: 'semantic' as const, snippet }
  })
}

export function combinedSearch(reels: Reel[], q: string): SearchResult[] {
  const kw = keywordSearch(reels, q)
  const sm = semanticSearch(reels, q)
  const map = new Map<string, SearchResult>()
  for (const r of kw) map.set(r.reel.id, { ...r, score: r.score * 0.4 })
  for (const r of sm) {
    const ex = map.get(r.reel.id)
    if (ex) { ex.score += r.score * 0.6; ex.matchType = 'combined' }
    else map.set(r.reel.id, { ...r, score: r.score * 0.6 })
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score)
}
