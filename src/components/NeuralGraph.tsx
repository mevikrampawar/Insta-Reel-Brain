import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Network, RotateCcw, Info, X } from 'lucide-react'
import { CATEGORY_COLORS, getCategoryColor } from '../utils/constants'
import type { Reel } from '../types'

interface Props { reels: Reel[]; onReelClick?: (reelId: string) => void }

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(129, 140, 248, ${alpha})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

interface GraphNode {
  id: string
  name: string
  color: string
  val: number
  type: 'root' | 'category' | 'reel'
  depth: number
  categoryPath?: string[]
  reelId?: string
  creator?: string
  tags?: string
  x?: number
  y?: number
  fx?: number
  fy?: number
}

interface GraphLink {
  source: string
  target: string
}

export function NeuralGraph({ reels, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const didFit = useRef(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [legendOpen, setLegendOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions(prev => (prev.width === width && prev.height === height) ? prev : { width, height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Auto-hide the interaction hint after a few seconds
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const { nodes, links, graphStats, nodeColors } = useMemo(() => {
    if (completeReels.length === 0) return { nodes: [], links: [], graphStats: { nodes: 0, edges: 0, categories: 0 }, nodeColors: new Map<string, string>() }

    const categoryReelCount = new Map<string, number>()
    const graphNodes: GraphNode[] = []
    const graphLinks: GraphLink[] = []
    const addedCategories = new Set<string>()

    graphNodes.push({
      id: 'root',
      name: 'Reel Brain',
      color: '#818cf8',
      val: 20,
      type: 'root',
      depth: 0,
      fx: 0, fy: 0,
    })

    function ensureCategoryNode(path: string[]): string {
      const key = path.join('>')
      if (addedCategories.has(key)) return key
      addedCategories.add(key)

      const depth = path.length
      const baseColor = getCategoryColor(path[0])
      const baseSize = depth === 1 ? 10 : depth === 2 ? 6 : 4

      graphNodes.push({
        id: key,
        name: path[path.length - 1],
        color: baseColor,
        val: baseSize,
        type: 'category',
        depth,
        categoryPath: path,
      })

      const parentKey = depth === 1 ? 'root' : path.slice(0, -1).join('>')
      if (depth > 1) ensureCategoryNode(path.slice(0, -1))
      graphLinks.push({ source: parentKey, target: key })

      return key
    }

    for (const reel of completeReels) {
      const path = reel.categoryPath?.length
        ? reel.categoryPath
        : [reel.primaryCategory || 'Other', 'Uncategorized']

      for (let i = 1; i <= path.length; i++) {
        ensureCategoryNode(path.slice(0, i))
      }

      for (let i = 0; i < path.length; i++) {
        const catKey = path.slice(0, i + 1).join('>')
        categoryReelCount.set(catKey, (categoryReelCount.get(catKey) || 0) + 1)
      }

      const reelNodeId = `reel-${reel.id}`
      const baseColor = getCategoryColor(path[0])
      graphNodes.push({
        id: reelNodeId,
        name: reel.title || 'Untitled',
        color: baseColor,
        val: 1,
        type: 'reel',
        depth: path.length + 1,
        reelId: reel.id,
        creator: reel.creatorHandle,
        tags: (reel.suggestedTags || []).slice(0, 3).join(', '),
      })

      graphLinks.push({ source: path.join('>'), target: reelNodeId })
    }

    for (const node of graphNodes) {
      if (node.type === 'category') {
        const count = categoryReelCount.get(node.id) || 0
        const baseSize = node.depth === 1 ? 10 : node.depth === 2 ? 6 : 4
        node.val = baseSize + Math.min(count * 0.5, 8)
      }
    }

    const colorById = new Map<string, string>(graphNodes.map(n => [n.id, n.color]))

    return {
      nodes: graphNodes,
      links: graphLinks,
      nodeColors: colorById,
      graphStats: {
        nodes: graphNodes.filter(n => n.type === 'reel').length,
        edges: graphLinks.length,
        categories: graphNodes.filter(n => n.type === 'category').length,
      },
    }
  }, [completeReels])

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'reel' && node.reelId && onReelClick) {
      onReelClick(node.reelId)
    }
  }, [onReelClick])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoverNode(node?.id ?? null)
  }, [])

  const nodeLabel = useCallback((node: GraphNode) => {
    if (node.type === 'root') {
      return `<div style="background:#18181b;color:#c7d2fe;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:700;border:1px solid #4f46e5;text-align:center;">Reel Brain</div>`
    }
    if (node.type === 'category') {
      const cat = node.categoryPath?.[0] || 'Other'
      return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
        <div style="font-weight:600;margin-bottom:2px;color:${getCategoryColor(cat)}">${node.name}</div>
        <div style="color:#a1a1aa;font-size:10px;">${node.categoryPath?.join(' → ') || ''}</div>
      </div>`
    }
    return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
      <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
      <div style="color:#a1a1aa;font-size:11px;">@${node.creator || 'unknown'}</div>
      ${node.tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${node.tags}</div>` : ''}
    </div>`
  }, [])

  const nodeRadius = useCallback((node: GraphNode) => {
    if (node.type === 'root') return 16
    if (node.type === 'category') return Math.max(7, Math.sqrt(node.val || 1) * 3.4)
    return 3.4
  }, [])

  const handleNodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = nodeRadius(node)
    const isHovered = hoverNode === node.id

    if (node.type === 'root') {
      const halo = r * 2.6
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, halo)
      g.addColorStop(0, 'rgba(129, 140, 248, 0.5)')
      g.addColorStop(1, 'rgba(129, 140, 248, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, halo, 0, 2 * Math.PI)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = '#818cf8'
      ctx.fill()
      ctx.strokeStyle = '#c7d2fe'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()

      ctx.font = `bold ${14 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = '#e0e7ff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(node.name, x, y + r + 6 / globalScale)
      return
    }

    if (node.type === 'category') {
      const halo = r * 2
      const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, halo)
      g.addColorStop(0, hexToRgba(node.color, isHovered ? 0.6 : 0.4))
      g.addColorStop(1, hexToRgba(node.color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, halo, 0, 2 * Math.PI)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = node.color
      ctx.globalAlpha = isHovered ? 1 : 0.9
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.lineWidth = 1 / globalScale
      ctx.stroke()

      ctx.font = `600 ${11 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(228, 228, 231, 0.92)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(node.name, x, y + r + 4 / globalScale)
      return
    }

    // Reel node — small dot, enlarged + highlighted on hover
    ctx.beginPath()
    ctx.arc(x, y, isHovered ? r * 1.6 : r, 0, 2 * Math.PI)
    ctx.fillStyle = isHovered ? '#ffffff' : node.color
    ctx.globalAlpha = isHovered ? 1 : 0.85
    ctx.fill()
    ctx.globalAlpha = 1
    if (isHovered) {
      ctx.strokeStyle = hexToRgba(node.color, 0.9)
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }
    if (globalScale > 1.6) {
      const title = node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name
      ctx.font = `${9 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(161, 161, 170, 0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(title, x, y + r + 3 / globalScale)
    }
  }, [nodeRadius, hoverNode])

  const handleNodePointerArea = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    const r = Math.max(nodeRadius(node) * 1.8, 6)
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeRadius])

  const linkColor = useCallback((link: GraphLink) => {
    return hexToRgba(nodeColors.get(link.source as string) || '#818cf8', 0.28)
  }, [nodeColors])

  const handleRecalibrate = useCallback(() => {
    fgRef.current?.zoomToFit(800, 40)
  }, [])

  // Configure forces once the graph is populated
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge) {
      charge.strength(-300)
      charge.distanceMax(450)
    }
    const link = fg.d3Force('link')
    if (link) {
      link.distance(60)
      link.strength(0.4)
    }
    const center = fg.d3Force('center')
    if (center) center.strength(0.1)
  }, [nodes, links])

  // One-time fit-to-screen once the graph first renders
  useEffect(() => {
    if (graphData.nodes.length === 0 || didFit.current) return
    didFit.current = true
    const t = setTimeout(() => {
      fgRef.current?.zoomToFit(600, 40)
    }, 300)
    return () => clearTimeout(t)
  }, [graphData])

  if (completeReels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 px-6">
          <Network size={32} className="text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-400">No analyzed reels to visualize</p>
          <p className="text-xs text-zinc-600">Add reels to grow your Reel Brain</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(130% 100% at 50% 0%, #101014 0%, #09090b 60%)' }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeVal="val"
        nodeColor="color"
        nodeLabel={nodeLabel}
        nodeCanvasObject={handleNodeCanvasObject}
        nodePointerAreaPaint={handleNodePointerArea}
        linkColor={linkColor}
        linkWidth={0.8}
        linkCurvature={0.12}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        d3VelocityDecay={0.4}
        warmupTicks={30}
        cooldownTicks={80}
      />

      {/* Fit to screen */}
      <button
        onClick={handleRecalibrate}
        className="absolute top-3 right-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg p-2 text-zinc-400 hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer z-10"
        title="Fit graph to screen"
        aria-label="Fit graph to screen"
      >
        <RotateCcw size={14} />
      </button>

      {/* Interaction hint — auto-hides */}
      {showHint && (
        <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none z-10">
          <p>Drag to pan · Pinch or scroll to zoom · Tap a reel to open</p>
        </div>
      )}

      {/* Legend toggle */}
      <button
        onClick={() => setLegendOpen(v => !v)}
        className="absolute bottom-4 left-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg p-2 text-zinc-400 hover:text-indigo-400 transition-colors z-10"
        aria-label={legendOpen ? 'Close legend' : 'Open legend'}
      >
        {legendOpen ? <X size={14} /> : <Info size={14} />}
      </button>

      {/* Legend */}
      <div className={`absolute bottom-14 left-3 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 text-xs space-y-1 max-h-[40vh] overflow-y-auto z-10 transition-all ${legendOpen ? 'block' : 'hidden'}`}>
        <p className="font-medium text-zinc-300 mb-1">Categories</p>
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'Other').map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-zinc-400 text-[11px]">{cat}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-zinc-800 space-y-0.5">
          <p className="text-[10px] text-zinc-500">Larger nodes = more reels</p>
          <p className="text-[10px] text-zinc-500">Center = Reel Brain root</p>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 right-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[9px] text-zinc-500 pointer-events-none z-10 flex items-center gap-1.5">
        <Network size={9} className="text-indigo-400" />
        {graphStats.nodes} reels · {graphStats.categories} cats
      </div>
    </div>
  )
}
