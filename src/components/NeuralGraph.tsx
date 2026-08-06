import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Network, RotateCcw, Info, X, Search, ZoomIn } from 'lucide-react'
import { buildBrainNetwork, BRAIN_NODE_COLORS, type BrainNode, type BrainLink } from '../utils/brainNetwork'
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

function linkId(id: string | object): string {
  return typeof id === 'object' && id !== null ? (id as BrainNode).id : (id as string)
}

function truncateLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

export function NeuralGraph({ reels, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const didFit = useRef(false)
  const prevQuery = useRef('')
  const lastClick = useRef<{ id: string; at: number } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [legendOpen, setLegendOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const network = useMemo(() => buildBrainNetwork(completeReels), [completeReels])

  const nodeColors = useMemo(() => new Map(network.nodes.map(n => [n.id, n.color])), [network])

  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    if (selectedId == null) return ids
    ids.add(selectedId)
    for (const link of network.links) {
      const src = linkId(link.source)
      const tgt = linkId(link.target)
      if (src === selectedId) ids.add(tgt)
      if (tgt === selectedId) ids.add(src)
    }
    return ids
  }, [selectedId, network.links])

  const graphData = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return network
    const matched = new Set<string>()
    for (const reel of completeReels) {
      const hay = [
        reel.title,
        reel.caption,
        reel.creatorHandle,
        ...(reel.suggestedTags || []),
        ...(reel.concepts || []).map(c => c.conceptName),
        ...(reel.entities || []).map(e => e.name),
        ...(reel.keyTakeaways || []),
      ].join(' ').toLowerCase()
      if (hay.includes(q)) matched.add(`reel-${reel.id}`)
    }
    if (matched.size === 0) return { nodes: [], links: [] }
    const keep = new Set<string>(matched)
    for (const link of network.links) {
      const src = linkId(link.source)
      const tgt = linkId(link.target)
      if (matched.has(src)) keep.add(tgt)
      if (matched.has(tgt)) keep.add(src)
    }
    return {
      nodes: network.nodes.filter(n => keep.has(n.id)),
      links: network.links.filter(l => keep.has(linkId(l.source)) && keep.has(linkId(l.target))),
    }
  }, [query, network, completeReels])

  const nodeRadius = useCallback((node: BrainNode) => {
    const v = Math.max(node.val, 1)
    if (node.type === 'reel') return Math.min(3.5 + Math.sqrt(v) * 1.1, 8)
    if (node.type === 'concept') return Math.min(4.5 + Math.sqrt(v) * 1.3, 12)
    if (node.type === 'creator') return Math.min(4 + Math.sqrt(v) * 0.8, 7)
    return 3.5
  }, [])

  const handleNodeClick = useCallback((node: BrainNode) => {
    const now = Date.now()
    const prev = lastClick.current
    lastClick.current = { id: node.id, at: now }
    if (prev && prev.id === node.id && now - prev.at < 400) {
      const fg = fgRef.current
      if (fg) {
        fg.centerAt(node.x, node.y, 350)
        fg.zoom(2.6, 600)
      }
      return
    }
    if (node.type === 'reel') {
      if (node.reelIds?.[0] && onReelClick) onReelClick(node.reelIds[0])
      return
    }
    setSelectedId(prevSel => (prevSel === node.id ? null : node.id))
  }, [onReelClick])

  const handleNodeHover = useCallback((node: BrainNode | null) => {
    setHoverNodeId(node?.id ?? null)
  }, [])

  const nodeLabel = useCallback((node: BrainNode) => {
    const count = node.reelIds.length
    if (node.type === 'reel') {
      const creator = completeReels.find(r => r.id === node.reelIds[0])?.creatorHandle
      const tags = completeReels.find(r => r.id === node.reelIds[0])?.suggestedTags?.slice(0, 3).join(', ')
      return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:240px;border:1px solid #27272a;">
        <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
        <div style="color:#a1a1aa;font-size:11px;">@${creator || 'unknown'}</div>
        ${tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${tags}</div>` : ''}
      </div>`
    }
    return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:240px;border:1px solid #27272a;">
      <div style="font-weight:600;margin-bottom:2px;color:${node.color}">${node.name}</div>
      <div style="color:#a1a1aa;font-size:10px;">${node.type} · ${count} reel${count === 1 ? '' : 's'}</div>
    </div>`
  }, [completeReels])

  const handleNodeCanvasObject = useCallback((node: BrainNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = nodeRadius(node)
    const dimmed = selectedId != null && node.id !== selectedId && !connectedIds.has(node.id)
    const hovered = hoverNodeId === node.id
    const isSelected = selectedId === node.id
    ctx.globalAlpha = dimmed ? 0.1 : hovered ? 1 : 0.88

    if (node.type === 'concept') {
      ctx.beginPath()
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r * 0.72, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r * 0.72, y)
      ctx.closePath()
      ctx.fillStyle = node.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1 / globalScale
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = node.color
      ctx.fill()
      if (node.type === 'reel' && !hovered) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.lineWidth = 1 / globalScale
        ctx.stroke()
      }
    }

    if (isSelected) {
      ctx.beginPath()
      ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()
    }
    if (hovered && node.type !== 'concept') {
      ctx.beginPath()
      ctx.arc(x, y, r + 2.5, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()
    }

    ctx.globalAlpha = 1

    const showLabel = hovered || isSelected || globalScale > 1.6
    if (!showLabel || dimmed) return
    const bold = node.type === 'concept' || node.type === 'creator'
    ctx.font = `${bold ? 600 : 400} ${(node.type === 'concept' ? 10 : 9) / globalScale}px Inter, system-ui, sans-serif`
    ctx.fillStyle = hovered ? '#ffffff' : 'rgba(212, 212, 216, 0.95)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const label = truncateLabel(ctx, node.name, 170 / globalScale)
    ctx.fillText(label, x, y + r + 3 / globalScale)
  }, [nodeRadius, selectedId, connectedIds, hoverNodeId])

  const handleNodePointerArea = useCallback((node: BrainNode, color: string, ctx: CanvasRenderingContext2D) => {
    const r = Math.max(nodeRadius(node) * 1.8, 7)
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeRadius])

  const linkColor = useCallback((link: BrainLink) => {
    if (selectedId != null) {
      const src = linkId(link.source)
      const tgt = linkId(link.target)
      if (!connectedIds.has(src) || !connectedIds.has(tgt)) return 'rgba(255,255,255,0.035)'
    }
    const srcColor = nodeColors.get(linkId(link.source)) || '#818cf8'
    return hexToRgba(srcColor, link.kind === 'similarity' ? 0.35 : 0.3)
  }, [nodeColors, selectedId, connectedIds])

  const linkWidth = useCallback((link: BrainLink) => {
    const v = Math.max(link.value || 0, 0.05)
    if (link.kind === 'similarity') return 0.5 + Math.min(v, 1) * 1.4
    if (link.kind === 'cooccurrence') return 0.6 + Math.min(v, 1) * 0.8
    return 0.8 + Math.min(v, 1) * 1.2
  }, [])

  const handleReset = useCallback(() => {
    setSelectedId(null)
    fgRef.current?.zoomToFit(800, 50)
  }, [])

  // Configure forces once the network is built
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge) {
      charge.strength(-220)
      charge.distanceMax(650)
    }
    const link = fg.d3Force('link')
    if (link) {
      link.distance(42)
      link.strength(0.35)
    }
    const center = fg.d3Force('center')
    if (center) center.strength(0.12)
    if (fg.d3 && typeof fg.d3.forceCollide === 'function') {
      fg.d3Force('collide', fg.d3.forceCollide().radius((n: BrainNode) => nodeRadius(n) + 6).iterations(2))
    }
  }, [network, nodeRadius])

  // One-time fit on first render
  useEffect(() => {
    if (graphData.nodes.length === 0 || didFit.current) return
    didFit.current = true
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 50), 350)
    return () => clearTimeout(t)
  }, [graphData])

  // Refit when a search is cleared
  useEffect(() => {
    const wasFiltering = prevQuery.current
    prevQuery.current = query
    if (wasFiltering && !query && graphData.nodes.length > 0) {
      const t = setTimeout(() => fgRef.current?.zoomToFit(600, 50), 350)
      return () => clearTimeout(t)
    }
  }, [query, graphData])

  const selectedNode = useMemo(() => {
    if (!selectedId) return null
    return network.nodes.find(n => n.id === selectedId) || null
  }, [selectedId, network])

  const selectedReels = useMemo(() => {
    if (!selectedNode) return []
    return completeReels.filter(r => selectedNode.reelIds.includes(r.id))
  }, [selectedNode, completeReels])

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

  const filteredEmpty = graphData.nodes.length === 0 && query.trim().length > 0

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(130% 100% at 50% 0%, #101014 0%, #09090b 60%)' }}
    >
      <ForceGraph2D<BrainNode, BrainLink>
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
        linkWidth={linkWidth}
        linkCurvature={0.12}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        d3VelocityDecay={0.35}
        warmupTicks={30}
        cooldownTicks={120}
      />

      {filteredEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center space-y-2 px-6">
            <Search size={26} className="text-zinc-700 mx-auto" />
            <p className="text-sm text-zinc-400">No reels match your search</p>
            <p className="text-xs text-zinc-600">Try another keyword or tag</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(340px,calc(100%-7rem))] z-10">
        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 focus-within:border-indigo-500 rounded-lg px-3 py-2 transition-colors">
          <Search size={13} className="text-zinc-500 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search reels, tags, creators…"
            className="bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
            aria-label="Search the graph"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-0.5" aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Reset view */}
      <button
        onClick={handleReset}
        className="absolute top-3 right-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg p-2 text-zinc-400 hover:text-indigo-400 flex items-center justify-center transition-colors cursor-pointer z-10 min-w-[36px] min-h-[36px]"
        title="Reset view"
        aria-label="Reset view"
      >
        <RotateCcw size={14} />
      </button>

      {/* Interaction hint — auto-hides */}
      {showHint && !query && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none z-10 whitespace-nowrap">
          <p>Drag to pan · Scroll or pinch to zoom · Tap a reel to open · Tap a concept to focus</p>
        </div>
      )}

      {/* Legend toggle */}
      <button
        onClick={() => setLegendOpen(v => !v)}
        className="absolute bottom-4 left-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg p-2 text-zinc-400 hover:text-indigo-400 transition-colors z-10 min-w-[36px] min-h-[36px]"
        aria-label={legendOpen ? 'Close legend' : 'Open legend'}
      >
        {legendOpen ? <X size={14} /> : <Info size={14} />}
      </button>

      {/* Legend */}
      <div className={`absolute bottom-14 left-3 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 text-xs space-y-1.5 max-h-[45vh] overflow-y-auto z-10 transition-all ${legendOpen ? 'block' : 'hidden'}`}>
        <p className="font-medium text-zinc-300 mb-1">Node types</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.concept }} />
          <span className="text-zinc-400 text-[11px]">Concept</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.entity }} />
          <span className="text-zinc-400 text-[11px]">Entity (book, tool, person…)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.creator }} />
          <span className="text-zinc-400 text-[11px]">Creator</span>
        </div>
        <div className="pt-2 mt-2 border-t border-zinc-800">
          <p className="font-medium text-zinc-300 mb-1">Categories</p>
          <div className="space-y-1">
            {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'Other').map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-zinc-400 text-[11px]">{cat}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-zinc-800 space-y-0.5">
          <p className="text-[10px] text-zinc-500">Larger nodes = more connections</p>
          <p className="text-[10px] text-zinc-500">Similar reels are linked by topic</p>
        </div>
      </div>

      {/* Focus panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(360px,calc(100%-1.5rem))] bg-zinc-900/95 border border-zinc-700 rounded-xl p-3 z-10 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedNode.color }} />
              <span className="text-xs font-semibold text-zinc-200 truncate">{selectedNode.name}</span>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1" aria-label="Clear focus">
              <X size={13} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 capitalize mb-2">
            {selectedNode.type} · {selectedNode.reelIds.length} reel{selectedNode.reelIds.length === 1 ? '' : 's'}
          </p>
          {selectedReels.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {selectedReels.slice(0, 5).map(reel => (
                <button
                  key={reel.id}
                  onClick={() => onReelClick?.(reel.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors flex items-center gap-1.5 min-h-[32px]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(reel.primaryCategory || reel.categoryPath?.[0] || 'Other') }} />
                  <span className="truncate">{reel.title}</span>
                </button>
              ))}
              {selectedReels.length > 5 && (
                <p className="text-[10px] text-zinc-600 pl-2.5">+{selectedReels.length - 5} more</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800">
            <button onClick={() => { fgRef.current?.centerAt(selectedNode.x, selectedNode.y, 400); fgRef.current?.zoom(2.4, 600) }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors min-h-[32px]">
              <ZoomIn size={11} /> Focus
            </button>
            <button onClick={() => setSelectedId(null)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[32px]">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-4 right-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[9px] text-zinc-500 pointer-events-none z-10 flex items-center gap-1.5">
        <Network size={9} className="text-indigo-400" />
        {graphData.nodes.length} nodes · {graphData.links.length} links
      </div>
    </div>
  )
}
