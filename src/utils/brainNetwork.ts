import { getCategoryColor } from './constants'
import { buildTfIdfIndex, reelToText } from './tfidf'
import type { Reel } from '../types'

export type BrainNodeType = 'reel' | 'concept' | 'entity' | 'creator'
export type BrainLinkKind = 'concept' | 'entity' | 'creator' | 'bridge' | 'similar'

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
  kind: BrainLinkKind
  label: string
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

export const BRAIN_LINK_KINDS: Record<BrainLinkKind, string> = {
  concept: 'shares concept',
  entity: 'mentions',
  creator: 'created by',
  bridge: 'co-occurs',
  similar: 'similar topics',
}

const CONCEPT_WEIGHT_MIN = 0.3
const CONCEPT_MAX_PER_REEL = 3
const ENTITY_MIN_SHARE = 2
const BRIDGE_MIN_OVERLAP = 2
const SIMILARITY_THRESHOLD = 0.25
const TOP_SIMILAR_PER_REEL = 3

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

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
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

  const conceptCount = new Map<string, number>()
  const entityCount = new Map<string, number>()
  const reelConcepts = new Map<string, { name: string; weight: number }[]>()
  const reelEntities = new Map<string, string[]>()
  const reelCreators = new Map<string, string>()

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

    const concepts: { name: string; weight: number }[] = []
    for (const c of reel.concepts || []) {
      const name = c.conceptName.trim()
      if (!name) continue
      concepts.push({ name, weight: c.weight || 0 })
      conceptCount.set(name.toLowerCase(), (conceptCount.get(name.toLowerCase()) || 0) + 1)
    }
    reelConcepts.set(reel.id, concepts)

    const entities: string[] = []
    for (const e of reel.entities || []) {
      const name = e.name.trim()
      if (!name) continue
      entities.push(name)
      entityCount.set(name.toLowerCase(), (entityCount.get(name.toLowerCase()) || 0) + 1)
    }
    reelEntities.set(reel.id, entities)

    const creator = reel.creatorHandle?.trim()
    if (creator) reelCreators.set(reel.id, creator)
  }

  for (const reel of reels) {
    const reelId = `reel-${reel.id}`

    const kept = (reelConcepts.get(reel.id) || [])
      .filter(c => (conceptCount.get(c.name.toLowerCase()) || 0) >= ENTITY_MIN_SHARE || c.weight >= CONCEPT_WEIGHT_MIN)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, CONCEPT_MAX_PER_REEL)
    for (const c of kept) {
      const key = `concept-${c.name.toLowerCase()}`
      ensureNode({ id: key, type: 'concept', name: c.name, color: BRAIN_NODE_COLORS.concept, val: 1, reelIds: [] })
      const node = nodeById.get(key)!
      node.reelIds.push(reel.id)
      links.push({
        source: reelId,
        target: key,
        value: Math.max(c.weight, 0.15),
        kind: 'concept',
        label: `Shares concept "${c.name}"`,
      })
    }

    for (const name of reelEntities.get(reel.id) || []) {
      if ((entityCount.get(name.toLowerCase()) || 0) < ENTITY_MIN_SHARE) continue
      const key = `entity-${name.toLowerCase()}`
      ensureNode({ id: key, type: 'entity', name, color: BRAIN_NODE_COLORS.entity, val: 1, reelIds: [] })
      const node = nodeById.get(key)!
      node.reelIds.push(reel.id)
      links.push({ source: reelId, target: key, value: 0.6, kind: 'entity', label: `Mentions "${name}"` })
    }

    const creator = reelCreators.get(reel.id)
    if (creator) {
      const key = `creator-${creator.toLowerCase()}`
      ensureNode({ id: key, type: 'creator', name: `@${creator}`, color: BRAIN_NODE_COLORS.creator, val: 1, reelIds: [] })
      const node = nodeById.get(key)!
      node.reelIds.push(reel.id)
      links.push({ source: reelId, target: key, value: 0.8, kind: 'creator', label: `Created by @${creator}` })
    }
  }

  const reelsPerConcept = new Map<string, string[]>()
  const sharedConceptPairs = new Set<string>()
  for (const link of links) {
    if (link.kind === 'concept') {
      const arr = reelsPerConcept.get(link.target) || []
      arr.push(link.source)
      reelsPerConcept.set(link.target, arr)
    }
  }
  for (const [, reelIds] of reelsPerConcept) {
    for (let i = 0; i < reelIds.length; i++) {
      for (let j = i + 1; j < reelIds.length; j++) {
        sharedConceptPairs.add(pairKey(reelIds[i], reelIds[j]))
      }
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
      if (overlap >= BRIDGE_MIN_OVERLAP) {
        const a = nodeById.get(conceptKeys[i])!.name
        const b = nodeById.get(conceptKeys[j])!.name
        links.push({
          source: conceptKeys[i],
          target: conceptKeys[j],
          value: Math.min(overlap, 3),
          kind: 'bridge',
          label: `"${a}" & "${b}" together in ${overlap} reels`,
        })
      }
    }
  }

  if (reels.length > 1) {
    const index = buildTfIdfIndex(reels.map(r => ({ id: r.id, text: reelToText(r) })))
    const candidates: { a: string; b: string; score: number }[] = []
    for (let i = 0; i < index.documents.length; i++) {
      for (let j = i + 1; j < index.documents.length; j++) {
        const a = index.documents[i].id
        const b = index.documents[j].id
        const score = cosineSimilarity(index.documents[i].vector, index.documents[j].vector)
        if (score >= SIMILARITY_THRESHOLD && !sharedConceptPairs.has(pairKey(a, b))) {
          candidates.push({ a, b, score })
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
      links.push({
        source: `reel-${c.a}`,
        target: `reel-${c.b}`,
        value: c.score,
        kind: 'similar',
        label: `Similar topics — ${Math.round(c.score * 100)}%`,
      })
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
