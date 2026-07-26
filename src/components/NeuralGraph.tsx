import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { Network, RotateCcw } from 'lucide-react'
import * as THREE from 'three'
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

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']
}

function makeTextSprite(text: string, opts: { fontSize?: number; color?: string; bgColor?: string; padding?: number } = {}): THREE.Sprite {
  const fontSize = opts.fontSize || 48
  const color = opts.color || '#e4e4e7'
  const bgColor = opts.bgColor || 'rgba(0,0,0,0)'
  const padding = opts.padding || 10

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  const textWidth = ctx.measureText(text).width

  canvas.width = (textWidth + padding * 2) * 2
  canvas.height = fontSize * 2.5

  // Background
  if (bgColor !== 'rgba(0,0,0,0)') {
    ctx.fillStyle = bgColor
    const r = 8
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, r)
    ctx.fill()
  }

  // Text
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

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

  // Sphere
  const geo = new THREE.SphereGeometry(radius, 16, 16)
  const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 })
  group.add(new THREE.Mesh(geo, mat))

  // Text label above
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
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  useEffect(() => {
    const onResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const { nodes, links, graphStats } = useMemo(() => {
    if (completeReels.length === 0) return { nodes: [], links: [], graphStats: { nodes: 0, edges: 0, categories: 0 } }

    const categoryReelCount = new Map<string, number>()
    const graphNodes: GraphNode[] = []
    const graphLinks: GraphLink[] = []
    const addedCategories = new Set<string>()

    // Root node
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
      const baseColor = getCatColor(path[0])
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

      // Link to parent
      const parentKey = depth === 1 ? 'root' : path.slice(0, -1).join('>')
      if (depth > 1) ensureCategoryNode(path.slice(0, -1))
      graphLinks.push({ source: parentKey, target: key })

      return key
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

      // Count reels in each category level
      for (let i = 0; i < path.length; i++) {
        const catKey = path.slice(0, i + 1).join('>')
        categoryReelCount.set(catKey, (categoryReelCount.get(catKey) || 0) + 1)
      }

      // Create reel node
      const reelNodeId = `reel-${reel.id}`
      const baseColor = getCatColor(path[0])
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

      // Link reel to its leaf category
      graphLinks.push({ source: path.join('>'), target: reelNodeId })
    }

    // Update category node sizes based on reel count
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

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'reel' && node.reelId && onReelClick) {
      onReelClick(node.reelId)
    }
  }, [onReelClick])

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

  const handleRecalibrate = useCallback(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.cameraPosition({ x: 0, y: 200, z: 500 }, { x: 0, y: 0, z: 0 }, 1500)
  }, [])

  useEffect(() => {
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

    // Initial camera
    fg.cameraPosition({ x: 0, y: 200, z: 500 }, { x: 0, y: 0, z: 0 })
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
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeVal="val"
        nodeColor="color"
        nodeLabel={(node: GraphNode) => {
          if (node.type === 'root') {
            return `<div style="background:#18181b;color:#818cf8;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:700;border:1px solid #4f46e5;text-align:center;">
              Reel Brain
            </div>`
          }
          if (node.type === 'category') {
            const cat = node.categoryPath?.[0] || 'Other'
            return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
              <div style="font-weight:600;margin-bottom:2px;color:${getCatColor(cat)}">${node.name}</div>
              <div style="color:#a1a1aa;font-size:10px;">${node.categoryPath?.join(' → ') || ''}</div>
            </div>`
          }
          return `<div style="background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;border:1px solid #27272a;">
            <div style="font-weight:600;margin-bottom:3px;">${node.name}</div>
            <div style="color:#a1a1aa;font-size:11px;">@${node.creator || 'unknown'}</div>
            ${node.tags ? `<div style="color:#818cf8;font-size:10px;margin-top:3px;">${node.tags}</div>` : ''}
          </div>`
        }}
        nodeThreeObject={handleNodeThreeObject as any}
        nodeThreeObjectExtend={false}
        nodeOpacity={1}
        nodeResolution={16}
        linkColor={() => 'rgba(129, 140, 248, 0.35)'}
        linkWidth={0.8}
        linkOpacity={0.5}
        linkCurvature={0.1}
        backgroundColor="#09090b"
        showNavInfo={false}
        cooldownTime={25000}
        warmupTicks={100}
        onNodeClick={handleNodeClick}
        enablePointerInteraction={true}
        d3VelocityDecay={0.4}
      />

      {/* Recalibrate button */}
      <button
        onClick={handleRecalibrate}
        className="absolute top-3 right-3 bg-zinc-900/90 border border-zinc-700 hover:border-indigo-500 rounded-lg px-3 py-2 text-[11px] text-zinc-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        title="Reset camera to default view"
      >
        <RotateCcw size={12} />
        Recalibrate
      </button>

      {/* Instructions */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan · Drag nodes to rearrange</p>
        <p className="text-indigo-400">Click a reel to view in Library</p>
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
        <div className="mt-2 pt-2 border-t border-zinc-800 space-y-0.5">
          <p className="text-[10px] text-zinc-500">Larger nodes = more reels</p>
          <p className="text-[10px] text-zinc-500">Center = Reel Brain root</p>
          <p className="text-[10px] text-zinc-500">Threads = relationships</p>
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
