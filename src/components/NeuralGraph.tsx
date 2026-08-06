import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import ForceGraph2D from 'react-force-graph-2d'
import { Network, RotateCcw, Info, X } from 'lucide-react'
import * as THREE from 'three'
import { CATEGORY_COLORS, getCategoryColor } from '../utils/constants'
import type { Reel } from '../types'

interface Props { reels: Reel[]; onReelClick?: (reelId: string) => void }

const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

function makeTextSprite(text: string, opts: { fontSize?: number; color?: string; bgColor?: string; padding?: number } = {}): THREE.Sprite {
  const fontSize = opts.fontSize || 48
  const color = opts.color || '#e4e4e7'
  const bgColor = opts.bgColor || 'rgba(0,0,0,0)'
  const padding = opts.padding || 10

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  const textWidth = ctx.measureText(text).width

  canvas.width = (textWidth + padding * 2) * dpr
  canvas.height = fontSize * 2.5 * dpr
  ctx.scale(dpr, dpr)

  if (bgColor !== 'rgba(0,0,0,0)') {
    ctx.fillStyle = bgColor
    const r = 8
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width / dpr, canvas.height / dpr, r)
    ctx.fill()
  }

  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / dpr / 2, canvas.height / dpr / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  const aspect = canvas.width / canvas.height
  const scale = fontSize * 0.6
  sprite.scale.set(scale * aspect, scale, 1)
  return sprite
}

function createCategoryObject(label: string, color: string, radius: number): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(radius, 12, 12)
  const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 })
  group.add(new THREE.Mesh(geo, mat))
  const sprite = makeTextSprite(label, { fontSize: 40, color: '#e4e4e7' })
  sprite.position.y = radius + 4
  group.add(sprite)
  return group
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
  fz?: number
}

interface GraphLink {
  source: string
  target: string
}

export function NeuralGraph({ reels, onReelClick }: Props) {
  const fgRef = useRef<any>(null)
  const fg2dRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const didFit = useRef(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [legendOpen, setLegendOpen] = useState(false)
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

  const { nodes, links, graphStats } = useMemo(() => {
    if (completeReels.length === 0) return { nodes: [], links: [], graphStats: { nodes: 0, edges: 0, categories: 0 } }

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
      fx: 0, fy: 0, fz: 0,
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
        val: 1.5,
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

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'reel' && node.reelId && onReelClick) {
      onReelClick(node.reelId)
    }
  }, [onReelClick])

  const nodeLabel = useCallback((node: GraphNode) => {
    if (node.type === 'root') {
      return `<div style="background:#18181b;color:#818cf8;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:700;border:1px solid #4f46e5;text-align:center;">
        Reel Brain
      </div>`
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

  const handleNodeThreeObject = useCallback((node: GraphNode) => {
    if (node.type === 'root') {
      const group = new THREE.Group()
      const geo = new THREE.IcosahedronGeometry(10, 2)
      const mat = new THREE.MeshPhongMaterial({ color: '#818cf8', emissive: '#4f46e5', emissiveIntensity: 0.3, transparent: true, opacity: 0.9 })
      group.add(new THREE.Mesh(geo, mat))
      const sprite = makeTextSprite('Reel Brain', { fontSize: 56, color: '#c7d2fe' })
      sprite.position.y = 16
      group.add(sprite)
      return group
    }
    if (node.type === 'category') {
      return createCategoryObject(node.name, node.color, node.val)
    }
    return null
  }, [])

  const nodeRadius = useCallback((node: GraphNode) => {
    return Math.max(2.5, Math.sqrt(node.val || 1) * 4)
  }, [])

  const handleNodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = nodeRadius(node)
    const x = node.x ?? 0
    const y = node.y ?? 0

    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.fill()

    if (node.type === 'root') {
      ctx.font = `bold ${13 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = '#c7d2fe'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(node.name, x, y - r - 4 / globalScale)
    } else if (node.type === 'category') {
      ctx.font = `${11 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(228,228,231,0.95)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(node.name, x, y - r - 3 / globalScale)
    } else if (node.type === 'reel' && globalScale > 1.5) {
      const title = node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name
      ctx.font = `${9 / globalScale}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(161,161,170,0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(title, x, y - r - 2 / globalScale)
    }
  }, [nodeRadius])

  const handleNodePointerArea = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    const r = nodeRadius(node)
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeRadius])

  const handleRecalibrate = useCallback(() => {
    if (dimensions.width < 640) {
      fg2dRef.current?.zoomToFit(800, 40)
      return
    }
    const fg = fgRef.current
    if (!fg) return
    fg.cameraPosition(
      { x: 0, y: 200, z: 500 },
      { x: 0, y: 0, z: 0 },
      1500,
    )
  }, [dimensions.width])

  // Configure 3D forces + camera (desktop only)
  useEffect(() => {
    if (dimensions.width < 640) return
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge) {
      charge.strength(-400)
      charge.distanceMax(500)
    }
    const link = fg.d3Force('link')
    if (link) {
      link.distance(80)
      link.strength(0.3)
    }
    const center = fg.d3Force('center')
    if (center) center.strength(0.05)

    fg.cameraPosition(
      { x: 0, y: 200, z: 500 },
      { x: 0, y: 0, z: 0 },
    )
  }, [nodes, links, dimensions.width])

  // Configure 2D forces (mobile only)
  useEffect(() => {
    if (dimensions.width >= 640) return
    const fg = fg2dRef.current
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
  }, [nodes, links, dimensions.width])

  // One-time fit-to-screen on mobile once the graph first renders
  useEffect(() => {
    if (dimensions.width >= 640) return
    if (graphData.nodes.length === 0 || didFit.current) return
    didFit.current = true
    const t = setTimeout(() => {
      fg2dRef.current?.zoomToFit(600, 40)
    }, 300)
    return () => clearTimeout(t)
  }, [dimensions.width, graphData])

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

  const isMobile = dimensions.width < 640

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {dimensions.width > 0 && (isMobile ? (
        <ForceGraph2D
          ref={fg2dRef}
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
          linkColor={() => 'rgba(129, 140, 248, 0.35)'}
          linkWidth={0.8}
          linkCurvature={0.1}
          backgroundColor="#09090b"
          onNodeClick={handleNodeClick}
          d3VelocityDecay={0.4}
          warmupTicks={30}
          cooldownTicks={80}
        />
      ) : (
        <ForceGraph3D
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
          nodeThreeObject={handleNodeThreeObject as any}
          nodeThreeObjectExtend={false}
          nodeOpacity={1}
          nodeResolution={12}
          linkColor={() => 'rgba(129, 140, 248, 0.35)'}
          linkWidth={0.8}
          linkOpacity={0.5}
          linkCurvature={0.1}
          backgroundColor="#09090b"
          showNavInfo={false}
          cooldownTime={12000}
          warmupTicks={50}
          onNodeClick={handleNodeClick}
          enablePointerInteraction={true}
          d3VelocityDecay={0.4}
        />
      ))}

      {/* Recalibrate */}
      <button
        onClick={handleRecalibrate}
        className="absolute top-3 right-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg px-3 py-2 text-[11px] text-zinc-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer z-10"
        title={isMobile ? 'Fit graph to screen' : 'Reset camera'}
      >
        <RotateCcw size={12} />
        {!isMobile && 'Recalibrate'}
      </button>

      {/* Instructions */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none z-10 max-w-[200px] sm:max-w-none">
        <p>{isMobile ? 'Pinch to zoom · Drag to pan' : 'Scroll to zoom · Drag to pan · Drag nodes to rearrange'}</p>
        <p className="text-indigo-400">{isMobile ? 'Tap a reel to view' : 'Click a reel to view in Library'}</p>
      </div>

      {/* Mobile legend toggle */}
      {isMobile && (
        <button
          onClick={() => setLegendOpen(v => !v)}
          className="absolute bottom-4 left-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg p-2 text-zinc-400 hover:text-indigo-400 transition-colors z-10"
        >
          {legendOpen ? <X size={14} /> : <Info size={14} />}
        </button>
      )}

      {/* Legend */}
      <div className={`${isMobile
        ? `absolute bottom-14 left-3 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 text-xs space-y-1 max-h-[40vh] overflow-y-auto z-10 transition-all ${legendOpen ? 'block' : 'hidden'}`
        : 'absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 max-h-[50vh] overflow-y-auto'
      }`}>
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
      <div className={`${isMobile
        ? 'absolute bottom-4 right-14 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2 py-1.5 text-[9px] text-zinc-500 pointer-events-none z-10'
        : 'absolute bottom-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none'
      }`}>
        <div className="flex items-center gap-1.5">
          <Network size={isMobile ? 8 : 10} className="text-indigo-400" />
          {graphStats.nodes} reels · {graphStats.categories} cats · {graphStats.edges} links
        </div>
      </div>
    </div>
  )
}
