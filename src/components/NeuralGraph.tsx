import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Tag, X } from 'lucide-react'
import type { Reel } from '../types'

interface Props { reels: Reel[]; onReelClick?: (reelId: string) => void }

interface Node { id: string; name: string; type: 'reel' | 'concept' | 'creator' | 'entity'; reelId?: string; x: number; y: number; vx: number; vy: number; val: number; color: string; conceptType?: string; entityType?: string; reelCount?: number; handle?: string }
interface Edge { source: string; target: string; weight: number }

const COLORS = { reel: '#6366f1', concept: '#10b981', creator: '#f59e0b', entity: '#ef4444', topic: '#10b981', skill: '#f59e0b', person: '#ef4444', brand: '#ec4899', tool: '#06b6d4', framework: '#8b5cf6', trend: '#f97316' }

export function NeuralGraph({ reels, onReelClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<Node[]>([])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: Node | null }>({ x: 0, y: 0, node: null })
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const tapRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const conceptMap = new Map<string, { node: Node; reels: Set<string> }>()
    const creatorMap = new Map<string, { node: Node; reels: Set<string> }>()
    const entityMap = new Map<string, { node: Node; reels: Set<string> }>()

    const completeReels = reels.filter(r => r.ingestStatus === 'complete')

    for (const reel of completeReels) {
      const rid = `reel-${reel.id}`
      nodes.push({ id: rid, name: reel.title?.slice(0, 25) || 'Untitled', type: 'reel', reelId: reel.id, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 5, color: COLORS.reel })

      // Creator nodes
      if (reel.creatorHandle) {
        const cid = `creator-${reel.creatorHandle.toLowerCase()}`
        if (!creatorMap.has(cid)) {
          const node: Node = { id: cid, name: `@${reel.creatorHandle}`, type: 'creator', handle: reel.creatorHandle, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 4, color: COLORS.creator, reelCount: 0 }
          creatorMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        creatorMap.get(cid)!.reels.add(rid)
        creatorMap.get(cid)!.node.reelCount = (creatorMap.get(cid)!.node.reelCount || 0) + 1
        edges.push({ source: rid, target: cid, weight: 0.4 })
      }

      // Entity nodes
      for (const e of reel.entities || []) {
        const eid = `entity-${e.name.toLowerCase()}`
        if (!entityMap.has(eid)) {
          const node: Node = { id: eid, name: e.name, type: 'entity', entityType: e.type, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 3, color: COLORS.entity }
          entityMap.set(eid, { node, reels: new Set() })
          nodes.push(node)
        }
        entityMap.get(eid)!.reels.add(rid)
        edges.push({ source: rid, target: eid, weight: 0.3 })
      }

      // Concept nodes
      for (const c of reel.concepts || []) {
        const cid = `concept-${c.conceptName}`
        if (!conceptMap.has(cid)) {
          const node: Node = { id: cid, name: c.conceptName, type: 'concept', conceptType: c.conceptType, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 3, color: COLORS[c.conceptType as keyof typeof COLORS] || COLORS.concept }
          conceptMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        conceptMap.get(cid)!.reels.add(rid)
        edges.push({ source: rid, target: cid, weight: c.weight || 0.5 })
      }
    }

    // Concept-concept co-occurrence
    const conceptEntries = Array.from(conceptMap.entries())
    for (let i = 0; i < conceptEntries.length; i++) {
      for (let j = i + 1; j < conceptEntries.length; j++) {
        const [idA, dataA] = conceptEntries[i]
        const [idB, dataB] = conceptEntries[j]
        const shared = [...dataA.reels].filter(r => dataB.reels.has(r))
        if (shared.length >= 2) {
          const union = new Set([...dataA.reels, ...dataB.reels]).size
          const weight = shared.length / union
          if (weight > 0.2) edges.push({ source: idA, target: idB, weight: weight * 0.6 })
        }
      }
    }

    return { nodes, edges }
  }, [reels])

  useEffect(() => { nodesRef.current = nodes }, [nodes])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cam = cameraRef.current
    return { x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom }
  }, [])

  const findNodeAt = useCallback((sx: number, sy: number): Node | null => {
    const world = screenToWorld(sx, sy)
    for (const n of nodesRef.current) {
      const r = n.type === 'reel' ? 14 : n.type === 'creator' ? 11 : 9
      const dx = n.x - world.x, dy = n.y - world.y
      if (dx * dx + dy * dy < r * r) return n
    }
    return null
  }, [screenToWorld])

  const getNeighbors = useCallback((nodeId: string): Set<string> => {
    const neighbors = new Set<string>([nodeId])
    for (const e of edges) {
      if (e.source === nodeId) neighbors.add(e.target)
      if (e.target === nodeId) neighbors.add(e.source)
    }
    return neighbors
  }, [edges])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top

    const node = findNodeAt(sx, sy)
    if (node) {
      if (node.type === 'reel' && onReelClick && node.reelId) {
        onReelClick(node.reelId)
        return
      }
      setSelectedNode(node)
      setHighlighted(getNeighbors(node.id))
    } else {
      setSelectedNode(null)
      setHighlighted(new Set())
      dragRef.current = { startX: e.clientX, startY: e.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y }
    }
  }, [findNodeAt, onReelClick, getNeighbors])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top

    if (dragRef.current) {
      cameraRef.current.x = dragRef.current.camX + (e.clientX - dragRef.current.startX)
      cameraRef.current.y = dragRef.current.camY + (e.clientY - dragRef.current.startY)
      return
    }

    const node = findNodeAt(sx, sy)
    setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY, node }))
  }, [findNodeAt])

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const cam = cameraRef.current
    const newZoom = Math.max(0.2, Math.min(4, cam.zoom * zoomFactor))
    cam.x = sx - (sx - cam.x) * (newZoom / cam.zoom)
    cam.y = sy - (sy - cam.y) * (newZoom / cam.zoom)
    cam.zoom = newZoom
  }, [])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom: cameraRef.current.zoom }
      return
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const sx = touch.clientX - rect.left, sy = touch.clientY - rect.top

      tapRef.current = { x: sx, y: sy, time: Date.now() }

      const node = findNodeAt(sx, sy)
      if (node) {
        if (node.type === 'reel' && onReelClick && node.reelId) {
          onReelClick(node.reelId)
          tapRef.current = null
          return
        }
        setSelectedNode(node)
        setHighlighted(getNeighbors(node.id))
        tapRef.current = null
      } else {
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y }
      }
    }
  }, [findNodeAt, onReelClick, getNeighbors])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cam = cameraRef.current
      const newZoom = Math.max(0.2, Math.min(4, pinchRef.current.zoom * (dist / pinchRef.current.dist)))
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const sx = midX - rect.left, sy = midY - rect.top
        cam.x = sx - (sx - cam.x) * (newZoom / cam.zoom)
        cam.y = sy - (sy - cam.y) * (newZoom / cam.zoom)
      }
      cam.zoom = newZoom
      return
    }
    if (e.touches.length === 1 && dragRef.current) {
      const touch = e.touches[0]
      cameraRef.current.x = dragRef.current.camX + (touch.clientX - dragRef.current.startX)
      cameraRef.current.y = dragRef.current.camY + (touch.clientY - dragRef.current.startY)
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tapRef.current && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const sx = touch.clientX - rect.left, sy = touch.clientY - rect.top
        const dx = sx - tapRef.current.x, dy = sy - tapRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) < 10 && Date.now() - tapRef.current.time < 300) {
          const node = findNodeAt(sx, sy)
          if (!node) {
            setSelectedNode(null)
            setHighlighted(new Set())
          }
        }
      }
      tapRef.current = null
    }
    dragRef.current = null
    pinchRef.current = null
  }, [findNodeAt])

  // Zoom controls
  const zoomIn = useCallback(() => { cameraRef.current.zoom = Math.min(4, cameraRef.current.zoom * 1.3) }, [])
  const zoomOut = useCallback(() => { cameraRef.current.zoom = Math.max(0.2, cameraRef.current.zoom / 1.3) }, [])
  const resetView = useCallback(() => { cameraRef.current = { x: 0, y: 0, zoom: 1 } }, [])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = container.clientWidth || 900
    let H = container.clientHeight || 600
    canvas.width = W
    canvas.height = H

    const onResize = () => {
      W = container.clientWidth || 900
      H = container.clientHeight || 600
      canvas.width = W
      canvas.height = H
    }
    const resizeObs = new ResizeObserver(onResize)
    resizeObs.observe(container)

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    let frame: number

    const draw = () => {
      const cam = cameraRef.current

      // Force simulation
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        const dx = t.x - s.x, dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 120) * 0.003 * e.weight
        s.vx += (dx / dist) * force; s.vy += (dy / dist) * force
        t.vx -= (dx / dist) * force; t.vy -= (dy / dist) * force
      }

      for (const n of nodes) {
        for (const m of nodes) {
          if (n === m) continue
          const dx = m.x - n.x, dy = m.y - n.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 120) {
            const force = -80 / (dist * dist)
            n.vx += (dx / dist) * force
            n.vy += (dy / dist) * force
          }
        }
      }

      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.0003
        n.vy += (H / 2 - n.y) * 0.0003
        n.vx *= 0.85; n.vy *= 0.85
        n.x += n.vx; n.y += n.vy
      }

      // Draw
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(cam.x, cam.y)
      ctx.scale(cam.zoom, cam.zoom)

      const hasHighlight = highlighted.size > 0

      // Edges
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        const bothHighlighted = hasHighlight && highlighted.has(e.source) && highlighted.has(e.target)
        const alpha = hasHighlight ? (bothHighlighted ? 0.6 : 0.05) : Math.min(e.weight * 0.6, 0.5)
        const isConceptEdge = s.type === 'concept' && t.type === 'concept'

        ctx.globalAlpha = alpha * 0.3
        ctx.strokeStyle = isConceptEdge ? '#818cf8' : '#52525b'
        ctx.lineWidth = e.weight * 4
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()

        ctx.globalAlpha = alpha
        ctx.strokeStyle = isConceptEdge ? '#6366f1' : '#3f3f46'
        ctx.lineWidth = e.weight * 1.5
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
      }

      // Nodes
      for (const n of nodes) {
        const isReel = n.type === 'reel'
        const isCreator = n.type === 'creator'
        const isEntity = n.type === 'entity'
        const r = isReel ? 10 : isCreator ? 8 : 7
        const dimmed = hasHighlight && !highlighted.has(n.id)
        const isSelected = selectedNode?.id === n.id

        ctx.globalAlpha = dimmed ? 0.1 : 1

        // Glow
        ctx.fillStyle = n.color
        ctx.beginPath()
        if (isReel) ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2)
        else if (isCreator) { ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2) }
        else ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2)
        ctx.globalAlpha = dimmed ? 0.02 : (isSelected ? 0.25 : 0.15)
        ctx.fill()

        // Node
        ctx.globalAlpha = dimmed ? 0.15 : 1
        ctx.fillStyle = n.color
        ctx.beginPath()
        if (isCreator) {
          // Diamond shape for creators
          ctx.moveTo(n.x, n.y - r)
          ctx.lineTo(n.x + r, n.y)
          ctx.lineTo(n.x, n.y + r)
          ctx.lineTo(n.x - r, n.y)
          ctx.closePath()
        } else if (isEntity) {
          // Rounded square for entities
          const s = r * 0.85
          ctx.roundRect(n.x - s, n.y - s, s * 2, s * 2, 3)
        } else {
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        }
        ctx.fill()

        // Selection ring
        if (isSelected && !dimmed) {
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.beginPath()
          if (isCreator) {
            ctx.moveTo(n.x, n.y - r - 3)
            ctx.lineTo(n.x + r + 3, n.y)
            ctx.lineTo(n.x, n.y + r + 3)
            ctx.lineTo(n.x - r - 3, n.y)
            ctx.closePath()
          } else {
            ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2)
          }
          ctx.stroke()
        }

        // Inner highlight
        ctx.globalAlpha = dimmed ? 0.05 : 0.3
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.beginPath(); ctx.arc(n.x - r * 0.25, n.y - r * 0.25, r * 0.4, 0, Math.PI * 2); ctx.fill()

        // Label
        if (showLabels && !dimmed) {
          ctx.globalAlpha = 1
          ctx.fillStyle = '#d4d4d8'
          ctx.font = isReel ? 'bold 10px Inter, sans-serif' : '9px Inter, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(n.name, n.x, n.y - r - 6)
        }
      }

      ctx.restore()
      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(frame); resizeObs.disconnect() }
  }, [nodes, edges, showLabels, highlighted, selectedNode])

  // Related reels for detail panel
  const relatedReels = useMemo(() => {
    if (!selectedNode) return []
    if (selectedNode.type === 'reel' && selectedNode.reelId) {
      const reel = reels.find(r => r.id === selectedNode.reelId)
      return reel ? [reel] : []
    }
    // Find reels connected to this node
    const connectedReelIds = new Set<string>()
    for (const e of edges) {
      if (e.source === selectedNode.id && e.target.startsWith('reel-')) connectedReelIds.add(e.target.replace('reel-', ''))
      if (e.target === selectedNode.id && e.source.startsWith('reel-')) connectedReelIds.add(e.source.replace('reel-', ''))
    }
    return reels.filter(r => connectedReelIds.has(r.id)).slice(0, 5)
  }, [selectedNode, edges, reels])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setTooltip(prev => ({ ...prev, node: null })) }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Tooltip — desktop only */}
      {tooltip.node && !selectedNode && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-xl max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-medium text-white truncate">{tooltip.node.name}</p>
          <p className="text-zinc-400 capitalize mt-0.5">
            {tooltip.node.type === 'reel' ? 'Reel' : tooltip.node.type === 'creator' ? `Creator · ${tooltip.node.reelCount || 0} reels` : tooltip.node.type === 'entity' ? `Entity · ${tooltip.node.entityType || ''}` : tooltip.node.conceptType || 'Concept'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button onClick={zoomOut} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button onClick={resetView} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Reset view">
          <Maximize2 size={16} />
        </button>
        <button onClick={() => setShowLabels(!showLabels)} className={`w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center transition-colors ${showLabels ? 'text-indigo-400 border-indigo-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Toggle labels">
          <Tag size={16} />
        </button>
      </div>

      {/* Hint */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan</p>
        {onReelClick && <p className="text-indigo-400">Tap blue node to view reel</p>}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.reel }} /><span className="text-zinc-400">Reel</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rotate-45" style={{ background: COLORS.creator }} /><span className="text-zinc-400">Creator</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: COLORS.entity }} /><span className="text-zinc-400">Entity</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.concept }} /><span className="text-zinc-400">Concept</span></div>
      </div>

      {/* Detail panel — bottom sheet on mobile, side panel on desktop */}
      {selectedNode && (
        <div className="absolute bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-16 md:w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{selectedNode.name}</p>
              <p className="text-[11px] text-zinc-500 capitalize">
                {selectedNode.type === 'reel' ? 'Reel' : selectedNode.type === 'creator' ? `Creator · ${selectedNode.reelCount || 0} reels` : selectedNode.type === 'entity' ? `Entity · ${selectedNode.entityType || ''}` : selectedNode.conceptType || 'Concept'}
              </p>
            </div>
            <button onClick={() => { setSelectedNode(null); setHighlighted(new Set()) }} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
              <X size={14} />
            </button>
          </div>

          {relatedReels.length > 0 && (
            <div className="p-3 max-h-60 overflow-auto">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                {selectedNode.type === 'reel' ? 'Details' : `Connected Reels (${relatedReels.length})`}
              </p>
              <div className="space-y-1.5">
                {relatedReels.map(r => (
                  <button
                    key={r.id}
                    onClick={() => onReelClick?.(r.id)}
                    className="w-full text-left px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                    <p className="text-[10px] text-zinc-500 truncate">@{r.creatorHandle || 'unknown'} · {r.suggestedTags?.slice(0, 3).join(', ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedNode.type !== 'reel' && relatedReels.length === 0 && (
            <div className="p-4 text-center text-xs text-zinc-600">
              No connected reels found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
