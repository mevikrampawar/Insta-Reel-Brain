import { useMemo, useCallback, useRef, useEffect } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { Network } from 'lucide-react'
import type { Reel, Collection } from '../types'

interface Props { reels: Reel[]; collections: Collection[]; onReelClick?: (reelId: string) => void }

const CATEGORY_COLORS: Record<string, string> = {
  educational: '#8b5cf6',
  entertainment: '#ec4899',
  motivational: '#f59e0b',
  instructional: '#3b82f6',
  review: '#10b981',
  storytelling: '#f97316',
  news: '#ef4444',
  other: '#6b7280',
}

function getCategoryColor(cat: string | undefined): string {
  return CATEGORY_COLORS[cat || 'other'] || CATEGORY_COLORS.other
}

function computeSimilarity(a: Reel, b: Reel): number {
  const tagsA = new Set(a.suggestedTags || [])
  const tagsB = new Set(b.suggestedTags || [])
  const entitiesA = new Set((a.entities || []).map(e => e.name.toLowerCase()))
  const entitiesB = new Set((b.entities || []).map(e => e.name.toLowerCase()))
  const conceptsA = new Set((a.concepts || []).map(c => c.conceptName.toLowerCase()))
  const conceptsB = new Set((b.concepts || []).map(c => c.conceptName.toLowerCase()))

  const allA = new Set([...tagsA, ...entitiesA, ...conceptsA])
  const allB = new Set([...tagsB, ...entitiesB, ...conceptsB])
  if (allA.size === 0 && allB.size === 0) return 0

  let intersection = 0
  for (const item of allA) if (allB.has(item)) intersection++
  return intersection / (allA.size + allB.size - intersection)
}

interface GraphNode {
  id: string
  name: string
  color: string
  val: number
  degree: number
  category: string
  creator: string
  tags: string
  reelId: string
}

interface GraphLink {
  source: string
  target: string
  width: number
}

export function NeuralGraph({ reels, collections: _collections, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const { nodes, links, graphStats } = useMemo(() => {
    if (completeReels.length === 0) return { nodes: [], links: [], graphStats: { nodes: 0, edges: 0 } }

    const edgeList: { source: string; target: string; weight: number }[] = []
    const degreeMap = new Map<string, number>()

    for (const reel of completeReels) {
      degreeMap.set(reel.id, 0)
    }

    for (let i = 0; i < completeReels.length; i++) {
      for (let j = i + 1; j < completeReels.length; j++) {
        const weight = computeSimilarity(completeReels[i], completeReels[j])
        if (weight >= 0.25) {
          edgeList.push({ source: completeReels[i].id, target: completeReels[j].id, weight })
          degreeMap.set(completeReels[i].id, (degreeMap.get(completeReels[i].id) || 0) + 1)
          degreeMap.set(completeReels[j].id, (degreeMap.get(completeReels[j].id) || 0) + 1)
        }
      }
    }

    const maxDegree = Math.max(1, ...degreeMap.values())

    const graphNodes: GraphNode[] = completeReels.map(reel => {
      const degree = degreeMap.get(reel.id) || 0
      return {
        id: reel.id,
        name: reel.title || 'Untitled',
        color: getCategoryColor(reel.primaryCategory),
        val: 1 + (degree / maxDegree) * 8,
        degree,
        category: reel.primaryCategory || 'other',
        creator: reel.creatorHandle,
        tags: (reel.suggestedTags || []).slice(0, 3).join(', '),
        reelId: reel.id,
      }
    })

    const graphLinks: GraphLink[] = edgeList.map(edge => ({
      source: edge.source,
      target: edge.target,
      width: 0.1 + edge.weight * 1.5,
    }))

    return {
      nodes: graphNodes,
      links: graphLinks,
      graphStats: { nodes: graphNodes.length, edges: graphLinks.length },
    }
  }, [completeReels])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.reelId && onReelClick) onReelClick(node.reelId)
  }, [onReelClick])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-120)
    fg.d3Force('link')?.distance((link: GraphLink) => 80 / (link.width || 1))
    fg.d3Force('center')?.strength(0.1)
  }, [nodes, links])

  if (completeReels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Network size={32} className="text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-400">No analyzed reels to visualize</p>
          <p className="text-xs text-zinc-600">Add reels to see your neural network</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={{ nodes, links }}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeVal="val"
        nodeColor="color"
        nodeLabel={(node: GraphNode) => `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
          <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
          <div style="color:#a1a1aa;font-size:11px;">@${node.creator}</div>
          ${node.tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${node.tags}</div>` : ''}
          <div style="color:#71717a;font-size:10px;margin-top:3px;">${node.degree} connections</div>
        </div>`}
        linkWidth="width"
        linkOpacity={0.25}
        linkColor={() => 'rgba(99, 102, 241, 0.6)'}
        backgroundColor="#09090b"
        showNavInfo={false}
        nodeOpacity={0.9}
        nodeResolution={12}
        cooldownTime={15000}
        warmupTicks={50}
        onNodeClick={handleNodeClick}
        enablePointerInteraction={true}
      />

      {/* Instructions */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan · Drag nodes to rearrange</p>
        <p className="text-indigo-400">Click a node to view the reel in Library</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block">
        <p className="font-medium text-zinc-300 mb-1">Categories</p>
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'other').map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-zinc-400 capitalize">{cat}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-500">Node size = connections</p>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none hidden sm:block">
        <div className="flex items-center gap-1.5">
          <Network size={10} className="text-indigo-400" />
          {graphStats.nodes} reels · {graphStats.edges} connections
        </div>
      </div>
    </div>
  )
}
