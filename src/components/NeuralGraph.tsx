import { useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Network, RotateCcw, Info, X, Search, ZoomIn, ExternalLink, Tags, BookOpen, Users, Brain } from 'lucide-react'
import { buildBrainNetwork, BRAIN_NODE_COLORS, BRAIN_LINK_KINDS, type BrainNode, type BrainLink } from '../utils/brainNetwork'
import { CATEGORY_COLORS, getCategoryColor } from '../utils/constants'
import type { Reel } from '../types'

interface Props { reels: Reel[]; onReelClick?: (reelId: string) => void }

const FIRING_MS = 700

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

interface ReelDetail {
  kind: 'reel'
  reel: Reel
  concepts: { name: string; weight: number }[]
  entities: string[]
  creator?: string
  similar: { reelId: string; title: string; score: number }[]
  bridges: string[]
}

interface NodeDetail {
  kind: 'node'
  node: BrainNode
  reels: Reel[]
}

type SelectedDetail = ReelDetail | NodeDetail | null

export function NeuralGraph({ reels, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const didFit = useRef(false)
  const lastClick = useRef<{ id: string; at: number } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [legendOpen, setLegendOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [hoverLink, setHoverLink] = useState<BrainLink | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tick, setTick] = useState(0)

  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(Math.round(rect.width), 0)
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    const navAllowance = isMobile ? 96 : 0
    const avail = Math.max(Math.round(window.innerHeight - rect.top - navAllowance), 0)
    const height = Math.max(Math.round(rect.height), avail)
    setDimensions(prev => (prev.width === width && prev.height === height) ? prev : { width, height })
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6000)
    return () => clearTimeout(t)
  }, [])

  // Brain pulse: sweep a firing synapse + keep the network gently alive
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return
      setTick(t => t + 1)
    }, FIRING_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return
      fgRef.current?.d3ReheatSimulation()
    }, 2600)
    return () => clearInterval(id)
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

  const firingLink = useMemo(() => {
    if (graphData.links.length === 0) return null
    return graphData.links[tick % graphData.links.length] || null
  }, [graphData, tick])

  const nodeRadius = useCallback((node: BrainNode) => {
    const v = Math.max(node.val, 1)
    if (node.type === 'reel') return Math.min(3.5 + Math.sqrt(v) * 1.1, 8)
    if (node.type === 'concept') return Math.min(4.5 + Math.sqrt(v) * 1.3, 12)
    if (node.type === 'creator') return Math.min(4 + Math.sqrt(v) * 0.8, 7)
    return 3
  }, [])

  const handleNodeClick = useCallback((node: BrainNode) => {
    const now = Date.now()
    const prev = lastClick.current
    lastClick.current = { id: node.id, at: now }
    if (prev && prev.id === node.id && now - prev.at < 400) {
      if (node.type === 'reel') {
        if (node.reelIds?.[0] && onReelClick) onReelClick(node.reelIds[0])
      } else {
        const fg = fgRef.current
        if (fg) {
          fg.centerAt(node.x, node.y, 350)
          fg.zoom(2.6, 600)
        }
      }
      return
    }
    setSelectedId(prevSel => (prevSel === node.id ? null : node.id))
  }, [onReelClick])

  const handleNodeHover = useCallback((node: BrainNode | null) => {
    setHoverNodeId(node?.id ?? null)
  }, [])

  const handleLinkHover = useCallback((link: BrainLink | null) => {
    setHoverLink(link)
  }, [])

  const nodeLabel = useCallback((node: BrainNode) => {
    const reel = completeReels.find(r => r.id === node.reelIds[0])
    if (node.type === 'reel' && reel) {
      const tags = reel.suggestedTags?.slice(0, 3).join(', ')
      return `<div style="background:#18181b;color:#e4e4e7;padding:8px 10px;border-radius:8px;font-size:12px;max-width:260px;border:1px solid #27272a;">
        <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
        <div style="color:#a1a1aa;font-size:11px;">@${reel.creatorHandle || 'unknown'}</div>
        ${reel.summary ? `<div style="color:#d4d4d8;font-size:11px;margin-top:3px;line-height:1.4;">${reel.summary.slice(0, 140)}${reel.summary.length > 140 ? '…' : ''}</div>` : ''}
        ${tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${tags}</div>` : ''}
      </div>`
    }
    const count = node.reelIds.length
    const verb = node.type === 'concept' ? 'shared topic' : node.type === 'entity' ? 'mentioned in' : 'created'
    return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:240px;border:1px solid #27272a;">
      <div style="font-weight:600;margin-bottom:2px;color:${node.color}">${node.name}</div>
      <div style="color:#a1a1aa;font-size:10px;">${node.type}${node.hub ? ' · hub' : ''} · ${verb} ${count} reel${count === 1 ? '' : 's'}</div>
    </div>`
  }, [completeReels])

  const handleNodeCanvasObject = useCallback((node: BrainNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = nodeRadius(node)
    const now = performance.now()
    const hovered = hoverNodeId === node.id
    const isSelected = selectedId === node.id
    const firingEndpoint = firingLink != null && (linkId(firingLink.source) === node.id || linkId(firingLink.target) === node.id)
    let dimmed = false
    if (selectedId != null) dimmed = !connectedIds.has(node.id)
    else if (hoverLink != null) dimmed = !(linkId(hoverLink.source) === node.id || linkId(hoverLink.target) === node.id)

    // Neuron halo — soft radial glow, breathing slowly
    if (!dimmed) {
      const haloR = r * (node.type === 'concept' ? (node.hub ? 3.6 : 2.8) : 2.2)
      const pulse = 0.8 + 0.2 * Math.sin(now / 320 + (node.index ?? 0))
      const haloAlpha = firingEndpoint ? 0.9 : hovered ? 0.5 : node.hub ? 0.42 : 0.3
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, haloR)
      g.addColorStop(0, hexToRgba(node.color, haloAlpha * pulse))
      g.addColorStop(1, hexToRgba(node.color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, haloR, 0, 2 * Math.PI)
      ctx.fill()
    }

    ctx.globalAlpha = dimmed ? 0.1 : 1
    if (node.type === 'concept') {
      ctx.beginPath()
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r * 0.72, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r * 0.72, y)
      ctx.closePath()
      ctx.fillStyle = node.color
      ctx.fill()
      ctx.strokeStyle = node.hub ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'
      ctx.lineWidth = (node.hub ? 1.4 : 1) / globalScale
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
    ctx.globalAlpha = 1

    if (isSelected) {
      const pulse = 0.6 + 0.4 * Math.sin(now / 250)
      ctx.beginPath()
      ctx.arc(x, y, r + 4 + pulse * 2, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()
    } else if (firingEndpoint) {
      const intensity = 1 - (now % FIRING_MS) / FIRING_MS
      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.7 * intensity})`
      ctx.lineWidth = (1.5 + intensity) / globalScale
      ctx.stroke()
    } else if (hovered) {
      ctx.beginPath()
      ctx.arc(x, y, r + 2, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()
    }

    const showLabel = hovered || isSelected || firingEndpoint || globalScale > 1.5
    if (!showLabel || dimmed) return
    const bold = node.type === 'concept' || node.type === 'creator'
    ctx.font = `${bold ? 600 : 400} ${(node.type === 'concept' ? 10 : 9) / globalScale}px Inter, system-ui, sans-serif`
    ctx.fillStyle = hovered || firingEndpoint ? '#ffffff' : 'rgba(212, 212, 216, 0.95)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const label = truncateLabel(ctx, node.name, 170 / globalScale)
    ctx.fillText(label, x, y + r + 3 / globalScale)
  }, [nodeRadius, selectedId, connectedIds, hoverNodeId, hoverLink, firingLink])

  const handleNodePointerArea = useCallback((node: BrainNode, color: string, ctx: CanvasRenderingContext2D) => {
    const r = Math.max(nodeRadius(node) * 1.8, 7)
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeRadius])

  const linkColor = useCallback((link: BrainLink) => {
    const isHoveredLink = hoverLink === link
    const isFiring = firingLink === link
    let dimmed = false
    if (selectedId != null) {
      const src = linkId(link.source)
      const tgt = linkId(link.target)
      dimmed = !connectedIds.has(src) || !connectedIds.has(tgt)
    } else if (hoverLink != null) {
      dimmed = link !== hoverLink
    }
    if (dimmed) return 'rgba(255,255,255,0.04)'
    if (isFiring) {
      const i = 1 - (performance.now() % FIRING_MS) / FIRING_MS
      return `rgba(255,255,255,${0.35 + 0.65 * i})`
    }
    if (isHoveredLink) return 'rgba(255,255,255,0.9)'
    const srcColor = nodeColors.get(linkId(link.source)) || '#818cf8'
    return hexToRgba(srcColor, link.kind === 'similar' ? 0.42 : 0.34)
  }, [nodeColors, selectedId, connectedIds, hoverLink, firingLink])

  const linkWidth = useCallback((link: BrainLink) => {
    const v = Math.max(link.value || 0, 0.05)
    const base = link.kind === 'similar' ? 0.5 + Math.min(v, 1) * 1.4
      : link.kind === 'bridge' ? 0.5 + Math.min(v, 1) * 0.7
      : 0.7 + Math.min(v, 1) * 1.1
    if (hoverLink === link) return base * 2.5
    if (firingLink === link) {
      const i = 1 - (performance.now() % FIRING_MS) / FIRING_MS
      return base * (1.3 + 1.4 * i)
    }
    return base
  }, [hoverLink, firingLink])

  const linkLabel = useCallback((link: BrainLink) => {
    const kind = BRAIN_LINK_KINDS[link.kind]
    const meta = link.kind === 'similar'
      ? `${Math.round(link.value * 100)}% topic match`
      : link.kind === 'bridge'
        ? `${Math.round(link.value)} reels share both`
        : link.kind === 'concept'
          ? `concept weight ${link.value.toFixed(2)}`
          : ''
    return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:11px;max-width:240px;border:1px solid #27272a;">
      <div style="font-weight:600;margin-bottom:2px;">${link.label}</div>
      <div style="color:#a1a1aa;font-size:10px;">${kind}${meta ? ` · ${meta}` : ''}</div>
    </div>`
  }, [])

  const handleReset = useCallback(() => {
    setSelectedId(null)
    setQuery('')
    fgRef.current?.zoomToFit(800, 50)
  }, [])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge) {
      charge.strength(-80)
      charge.distanceMax(420)
    }
    const link = fg.d3Force('link')
    if (link) {
      link.distance((l: BrainLink) => {
        const k = (l as BrainLink).kind
        if (k === 'concept') return 20
        if (k === 'similar') return 28
        if (k === 'creator' || k === 'entity') return 32
        return 48
      })
      link.strength(0.45)
    }
    const center = fg.d3Force('center')
    if (center) center.strength(0.3)
    if (fg.d3 && typeof fg.d3.forceCollide === 'function') {
      fg.d3Force('collide', fg.d3.forceCollide().radius((n: BrainNode) => nodeRadius(n) + 7).iterations(2))
    }
  }, [network, nodeRadius])

  useEffect(() => {
    if (graphData.nodes.length === 0) return
    if (dimensions.width === 0 || dimensions.height === 0) return
    if (didFit.current) return
    didFit.current = true
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 40), 350)
    return () => clearTimeout(t)
  }, [graphData, dimensions])

  useEffect(() => {
    if (query.trim() === '') didFit.current = false
  }, [query])

  const selectedDetail = useMemo<SelectedDetail>(() => {
    if (!selectedId) return null
    const node = network.nodes.find(n => n.id === selectedId)
    if (!node) return null
    const edges = network.links.filter(l => linkId(l.source) === selectedId || linkId(l.target) === selectedId)
    const otherId = (e: BrainLink) => (linkId(e.source) === selectedId ? linkId(e.target) : linkId(e.source))

    if (node.type === 'reel') {
      const reel = completeReels.find(r => r.id === node.reelIds[0])
      if (!reel) return null
      const concepts: { name: string; weight: number }[] = []
      const entities: string[] = []
      const similar: ReelDetail['similar'] = []
      const bridges: string[] = []
      let creator: string | undefined
      for (const e of edges) {
        const other = otherId(e)
        const on = network.nodes.find(n => n.id === other)
        if (e.kind === 'concept') concepts.push({ name: on?.name || other, weight: e.value })
        else if (e.kind === 'entity') entities.push(on?.name || other)
        else if (e.kind === 'creator') creator = on?.name || other
        else if (e.kind === 'similar') {
          const targetReel = completeReels.find(r => r.id === on?.reelIds?.[0])
          if (targetReel) similar.push({ reelId: targetReel.id, title: targetReel.title, score: e.value })
        }
        else if (e.kind === 'bridge') bridges.push(on?.name || other)
      }
      similar.sort((a, b) => b.score - a.score)
      return { kind: 'reel', reel, concepts, entities, creator, similar, bridges }
    }

    const reels = completeReels.filter(r => node.reelIds.includes(r.id))
    return { kind: 'node', node, reels }
  }, [selectedId, network, completeReels])

  if (completeReels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 px-6">
          <Brain size={32} className="text-zinc-700 mx-auto" />
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
      className="relative w-full"
      style={{
        height: dimensions.height || '55vh',
        background: 'radial-gradient(130% 100% at 50% 0%, #101014 0%, #09090b 60%)',
      }}
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
        linkLabel={linkLabel}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkCurvature={0.1}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}
        onBackgroundClick={() => setSelectedId(null)}
        d3VelocityDecay={0.3}
        warmupTicks={20}
        cooldownTicks={80}
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
      {showHint && !query && !selectedDetail && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none z-10 whitespace-nowrap">
          <p>Tap a neuron to explore · Hover a synapse for why · Double-tap a reel to open</p>
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
        <p className="font-medium text-zinc-300 mb-1">Neurons</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.concept }} />
          <span className="text-zinc-400 text-[11px]">Concept · shared topic (glows = hub)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.entity }} />
          <span className="text-zinc-400 text-[11px]">Entity (book, tool, person)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAIN_NODE_COLORS.creator }} />
          <span className="text-zinc-400 text-[11px]">Creator</span>
        </div>
        <div className="pt-2 mt-2 border-t border-zinc-800">
          <p className="font-medium text-zinc-300 mb-1">Synapses</p>
          {Object.entries(BRAIN_LINK_KINDS).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-2">
              <span className="w-3 h-px shrink-0" style={{ background: kind === 'similar' ? '#38bdf8' : kind === 'bridge' ? '#f472b6' : '#71717a' }} />
              <span className="text-zinc-400 text-[11px] capitalize">{label}</span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-600 mt-1">White flashes = synapses firing</p>
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
          <p className="text-[10px] text-zinc-500">Bigger + brighter = more connected</p>
          <p className="text-[10px] text-zinc-500">Dense clusters = related topics</p>
        </div>
      </div>

      {/* Connection detail panel */}
      {selectedDetail && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(380px,calc(100%-1.5rem))] bg-zinc-900/95 border border-zinc-700 rounded-xl p-3 z-10 shadow-xl shadow-black/40 max-h-[55vh] overflow-y-auto">
          {selectedDetail.kind === 'node' ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedDetail.node.color }} />
                  <span className="text-xs font-semibold text-zinc-200 truncate">{selectedDetail.node.name}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1" aria-label="Clear focus">
                  <X size={13} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mb-2">
                {selectedDetail.node.type === 'concept' ? 'Shared topic' : selectedDetail.node.type === 'entity' ? 'Entity mentioned in' : 'Creator of'}{' '}
                {selectedDetail.reels.length} reel{selectedDetail.reels.length === 1 ? '' : 's'}
              </p>
              {selectedDetail.reels.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {selectedDetail.reels.slice(0, 5).map(reel => (
                    <button
                      key={reel.id}
                      onClick={() => onReelClick?.(reel.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors flex items-center gap-1.5 min-h-[32px]"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(reel.primaryCategory || reel.categoryPath?.[0] || 'Other') }} />
                      <span className="truncate">{reel.title}</span>
                    </button>
                  ))}
                  {selectedDetail.reels.length > 5 && (
                    <p className="text-[10px] text-zinc-600 pl-2.5">+{selectedDetail.reels.length - 5} more</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800">
                <button onClick={() => { fgRef.current?.centerAt(selectedDetail.node.x, selectedDetail.node.y, 400); fgRef.current?.zoom(2.4, 600) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors min-h-[32px]">
                  <ZoomIn size={11} /> Focus
                </button>
                <button onClick={() => setSelectedId(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[32px]">
                  Clear
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getCategoryColor(selectedDetail.reel.primaryCategory || selectedDetail.reel.categoryPath?.[0] || 'Other') }} />
                  <span className="text-xs font-semibold text-zinc-200 truncate">{selectedDetail.reel.title}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1" aria-label="Close">
                  <X size={13} />
                </button>
              </div>
              {selectedDetail.reel.creatorHandle && (
                <p className="text-[10px] text-zinc-500 mb-1.5">@{selectedDetail.reel.creatorHandle}</p>
              )}
              {selectedDetail.reel.summary && (
                <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 mb-2.5">{selectedDetail.reel.summary}</p>
              )}

              {selectedDetail.concepts.length > 0 && (
                <div className="mb-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                    <Tags size={10} /> Concepts
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetail.concepts.map(c => (
                      <span key={c.name} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-300 rounded-lg text-[11px]">
                        {c.name}
                        <span className="text-[9px] text-violet-400/70">{Math.round(c.weight * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDetail.creator && (
                <div className="mb-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                    <Users size={10} /> Creator
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/10 text-rose-300 rounded-lg text-[11px]">{selectedDetail.creator}</span>
                </div>
              )}

              {selectedDetail.entities.length > 0 && (
                <div className="mb-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                    <BookOpen size={10} /> Mentioned
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetail.entities.map(name => (
                      <span key={name} className="px-2 py-1 bg-emerald-500/10 text-emerald-300 rounded-lg text-[11px]">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDetail.similar.length > 0 && (
                <div className="mb-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Similar reels</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {selectedDetail.similar.map(s => (
                      <button
                        key={s.reelId}
                        onClick={() => onReelClick?.(s.reelId)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors flex items-center gap-1.5 min-h-[32px]"
                      >
                        <span className="truncate flex-1">{s.title}</span>
                        <span className="text-[9px] text-sky-400 shrink-0">{Math.round(s.score * 100)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedDetail.bridges.length > 0 && (
                <div className="mb-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Co-occurs with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetail.bridges.map(name => (
                      <span key={name} className="px-2 py-1 bg-pink-500/10 text-pink-300 rounded-lg text-[11px]">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800">
                <button onClick={() => onReelClick?.(selectedDetail.reel.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors min-h-[32px]">
                  <ExternalLink size={11} /> Open reel
                </button>
                <button onClick={() => setSelectedId(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[32px]">
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-4 right-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[9px] text-zinc-500 pointer-events-none z-10 flex items-center gap-1.5">
        <Network size={9} className="text-indigo-400" />
        {graphData.nodes.length} neurons · {graphData.links.length} synapses
      </div>
    </div>
  )
}
