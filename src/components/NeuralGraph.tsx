import { useMemo, useCallback, useRef, useEffect } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { Network } from 'lucide-react'
import type { Reel, Collection } from '../types'

interface Props { reels: Reel[]; collections: Collection[]; onReelClick?: (reelId: string) => void }

const CATEGORY_COLORS: Record<string, string> = {
  'AI & Technology': '#8b5cf6',
  'Fitness & Health': '#10b981',
  'Business & Marketing': '#f59e0b',
  'Programming & Development': '#3b82f6',
  'Productivity & Self-improvement': '#ec4899',
  'Finance & Investing': '#14b8a6',
  'Creative & Design': '#f97316',
  'Education & Learning': '#6366f1',
  'Lifestyle & Entertainment': '#ef4444',
  'Food & Cooking': '#84cc16',
  'Other': '#6b7280',
}

const LEVEL_OPACITY = [1.0, 0.7, 0.5]
const LEVEL_SIZE = [6, 4, 2.5]

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function dimColor(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${opacity})`
}

interface GraphNode {
  id: string
  name: string
  color: string
  val: number
  type: 'category' | 'reel'
  depth: number
  categoryPath?: string[]
  reelId?: string
  creator?: string
  tags?: string
  childCount?: number
  fx?: number
  fy?: number
  fz?: number
}

interface GraphLink {
  source: string
  target: string
}

export function NeuralGraph({ reels, collections: _collections, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const { nodes, links, graphStats } = useMemo(() => {
    if (completeReels.length === 0) return { nodes: [], links: [], graphStats: { nodes: 0, edges: 0, categories: 0 } }

    const categoryNodes = new Map<string, { path: string[]; reelCount: number }>()
    const graphNodes: GraphNode[] = []
    const graphLinks: GraphLink[] = []
    const addedCategories = new Set<string>()

    function ensureCategoryNode(path: string[]): string {
      const key = path.join('>')
      if (addedCategories.has(key)) return key
      addedCategories.add(key)

      const nodeId = key
      const depth = path.length
      const baseColor = getCatColor(path[0])
      const opacity = LEVEL_OPACITY[Math.min(depth - 1, 2)]
      const size = LEVEL_SIZE[Math.min(depth - 1, 2)]

      categoryNodes.set(nodeId, { path, reelCount: 0 })

      graphNodes.push({
        id: nodeId,
        name: path[path.length - 1],
        color: dimColor(baseColor, opacity),
        val: size,
        type: 'category',
        depth,
        categoryPath: path,
      })

      // Link to parent
      if (path.length > 1) {
        const parentKey = path.slice(0, -1).join('>')
        ensureCategoryNode(path.slice(0, -1))
        graphLinks.push({ source: parentKey, target: nodeId })
      }

      return nodeId
    }

    // Process each reel
    for (const reel of completeReels) {
      const path = reel.categoryPath?.length
        ? reel.categoryPath
        : [reel.primaryCategory || 'Other', 'Uncategorized']

      // Ensure all category ancestors exist
      for (let i = 1; i <= path.length; i++) {
        ensureCategoryNode(path.slice(0, i))
      }

      // Count reels in leaf category
      const leafKey = path.join('>')
      const leafCat = categoryNodes.get(leafKey)
      if (leafCat) leafCat.reelCount++

      // Create reel node
      const reelNodeId = `reel-${reel.id}`
      const baseColor = getCatColor(path[0])
      graphNodes.push({
        id: reelNodeId,
        name: reel.title || 'Untitled',
        color: baseColor,
        val: 1.2,
        type: 'reel',
        depth: path.length + 1,
        reelId: reel.id,
        creator: reel.creatorHandle,
        tags: (reel.suggestedTags || []).slice(0, 3).join(', '),
      })

      // Link reel to its leaf category
      graphLinks.push({ source: leafKey, target: reelNodeId })
    }

    // Update category node sizes based on how many children they have
    for (const node of graphNodes) {
      if (node.type === 'category') {
        const cat = categoryNodes.get(node.id!)
        if (cat && cat.reelCount > 0) {
          node.val = LEVEL_SIZE[Math.min(node.depth - 1, 2)] + Math.min(cat.reelCount * 0.3, 4)
        }
      }
    }

    return {
      nodes: graphNodes,
      links: graphLinks,
      graphStats: {
        nodes: graphNodes.filter(n => n.type === 'reel').length,
        edges: graphLinks.length,
        categories: graphNodes.filter(n => n.type === 'category').length,
      },
    }
  }, [completeReels])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'reel' && node.reelId && onReelClick) {
      onReelClick(node.reelId)
    }
  }, [onReelClick])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-30)
    fg.d3Force('center')?.strength(0.05)
  }, [nodes, links])

  if (completeReels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Network size={32} className="text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-400">No analyzed reels to visualize</p>
          <p className="text-xs text-zinc-600">Add reels to see your knowledge tree</p>
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
        nodeLabel={(node: GraphNode) => {
          if (node.type === 'category') {
            const cat = node.categoryPath?.[0] || 'Other'
            return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
              <div style="font-weight:600;margin-bottom:3px;color:${getCatColor(cat)}">${node.name}</div>
              <div style="color:#a1a1aa;font-size:10px;">${node.categoryPath?.join(' → ') || ''}</div>
            </div>`
          }
          return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
            <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
            <div style="color:#a1a1aa;font-size:11px;">@${node.creator || 'unknown'}</div>
            ${node.tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${node.tags}</div>` : ''}
          </div>`
        }}
        nodeOpacity={1}
        nodeResolution={12}
        linkColor={() => 'rgba(99, 102, 241, 0.15)'}
        linkWidth={0.5}
        linkOpacity={0.4}
        backgroundColor="#09090b"
        showNavInfo={false}
        cooldownTime={20000}
        warmupTicks={100}
        dagMode="radialout"
        dagLevelDistance={60}
        onNodeClick={handleNodeClick}
        enablePointerInteraction={true}
      />

      {/* Instructions */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan · Drag nodes to rearrange</p>
        <p className="text-indigo-400">Click a reel node to view in Library</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block max-h-[50vh] overflow-y-auto">
        <p className="font-medium text-zinc-300 mb-1">Categories</p>
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'Other').map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-zinc-400 text-[11px]">{cat}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-500">Larger nodes = more reels</p>
          <p className="text-[10px] text-zinc-500">Radial layout = category hierarchy</p>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none hidden sm:block">
        <div className="flex items-center gap-1.5">
          <Network size={10} className="text-indigo-400" />
          {graphStats.nodes} reels · {graphStats.categories} categories · {graphStats.edges} links
        </div>
      </div>
    </div>
  )
}
