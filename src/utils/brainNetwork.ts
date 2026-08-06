import { getCategoryColor } from './constants'
import { buildTfIdfIndex, reelToText } from './tfidf'
import type { Reel } from '../types'

export type BrainNodeType = 'reel' | 'concept' | 'entity' | 'creator'

export interface BrainNode {
  id: string
  type: BrainNodeType
  name: string
  color: string
  val: number
  category?: string
  reelIds: string[]
  x?: number
  y?: number
  fx?: number
  fy?: number
}

export interface BrainLink {
  source: string
  target: string
  value: number
  kind: 'concept' | 'entity' | 'creator' | 'cooccurrence' | 'similarity'
}

export interface BrainNetwork {
  nodes: BrainNode[]
  links: BrainLink[]
}

export const BRAIN_NODE_COLORS: Record<'concept' | 'entity' | 'creator', string> = {
  concept: '#a78bfa',
  entity: '#34d399',
  creator: '#fb7185',
}

const SIMILARITY_THRESHOLD = 0.18
const TOP_SIMILAR_PER_REEL = 5

function cosineSimilarity(
  a: { terms: string[]; values: number[] },
  b: { terms: string[]; values: number[] },
): number {
  const bMap = new Map<string, number>()
  for (let i = 0; i < b.terms.length; i++) bMap.set(b.terms[i], b.values[i])
  let dot = 0
  for (let i = 0; i < a.terms.length; i++) {
    const bVal = bMap.get(a.terms[i])
    if (bVal !== undefined) dot += a.values[i] * bVal
  }
  return dot
}

export function buildBrainNetwork(reels: Reel[]): BrainNetwork {
  const nodes: BrainNode[] = []
  const links: BrainLink[] = []
  const nodeById = new Map<string, BrainNode>()

  function ensureNode(node: BrainNode): void {
    if (!nodeById.has(node.id)) {
      nodeById.set(node.id, node)
      nodes.push(node)
    }
  }

  for (const reel of reels) {
    const category = reel.primaryCategory || reel.categoryPath?.[0] || 'Other'
    ensureNode({
      id: `reel-${reel.id}`,
      type: 'reel',
      name: reel.title || 'Untitled',
      color: getCategoryColor(category),
      val: 1,
      category,
      reelIds: [reel.id],
    })
  }

  for (const reel of reels) {
    const reelId = `reel-${reel.id}`

    for (const c of reel.concepts || []) {
      const name = c.conceptName.trim()
      if (!name) continue
      const key = `concept-${name.toLowerCase()}`
      ensureNode({
        id: key,
        type: 'concept',
        name,
        color: BRAIN_NODE_COLORS.concept,
        val: 1,
        reelIds: [],
      })
      nodeById.get(key)!.reelIds.push(reel.id)
      links.push({ source: reelId, target: key, value: Math.max(c.weight || 0, 0.1), kind: 'concept' })
    }

    for (const e of reel.entities || []) {
      const name = e.name.trim()
      if (!name) continue
      const key = `entity-${name.toLowerCase()}`
      ensureNode({
        id: key,
        type: 'entity',
        name,
        color: BRAIN_NODE_COLORS.entity,
        val: 1,
        reelIds: [],
      })
      nodeById.get(key)!.reelIds.push(reel.id)
      links.push({ source: reelId, target: key, value: 0.6, kind: 'entity' })
    }

    const creator = reel.creatorHandle?.trim()
    if (creator) {
      const key = `creator-${creator.toLowerCase()}`
      ensureNode({
        id: key,
        type: 'creator',
        name: `@${creator}`,
        color: BRAIN_NODE_COLORS.creator,
        val: 1,
        reelIds: [],
      })
      nodeById.get(key)!.reelIds.push(reel.id)
      links.push({ source: reelId, target: key, value: 0.8, kind: 'creator' })
    }
  }

  const reelsPerConcept = new Map<string, string[]>()
  for (const link of links) {
    if (link.kind === 'concept') {
      const arr = reelsPerConcept.get(link.target) || []
      arr.push(link.source)
      reelsPerConcept.set(link.target, arr)
    }
  }
  const conceptKeys = [...reelsPerConcept.keys()]
  for (let i = 0; i < conceptKeys.length; i++) {
    const shared = new Set(reelsPerConcept.get(conceptKeys[i])!)
    for (let j = i + 1; j < conceptKeys.length; j++) {
      let overlap = 0
      for (const reelId of reelsPerConcept.get(conceptKeys[j])!) {
        if (shared.has(reelId)) overlap++
      }
      if (overlap > 0) {
        links.push({
          source: conceptKeys[i],
          target: conceptKeys[j],
          value: Math.min(overlap, 3),
          kind: 'cooccurrence',
        })
      }
    }
  }

  if (reels.length > 1) {
    const index = buildTfIdfIndex(reels.map(r => ({ id: r.id, text: reelToText(r) })))
    const candidates: { a: string; b: string; score: number }[] = []
    for (let i = 0; i < index.documents.length; i++) {
      for (let j = i + 1; j < index.documents.length; j++) {
        const score = cosineSimilarity(index.documents[i].vector, index.documents[j].vector)
        if (score >= SIMILARITY_THRESHOLD) {
          candidates.push({ a: index.documents[i].id, b: index.documents[j].id, score })
        }
      }
    }
    candidates.sort((x, y) => y.score - x.score)
    const simCount = new Map<string, number>()
    for (const c of candidates) {
      const ca = simCount.get(c.a) || 0
      const cb = simCount.get(c.b) || 0
      if (ca >= TOP_SIMILAR_PER_REEL || cb >= TOP_SIMILAR_PER_REEL) continue
      simCount.set(c.a, ca + 1)
      simCount.set(c.b, cb + 1)
      links.push({ source: `reel-${c.a}`, target: `reel-${c.b}`, value: c.score, kind: 'similarity' })
    }
  }

  const degree = new Map<string, number>()
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1)
    degree.set(link.target, (degree.get(link.target) || 0) + 1)
  }
  for (const node of nodes) {
    node.val = (degree.get(node.id) || 0) + 1
  }

  return { nodes, links }
}
