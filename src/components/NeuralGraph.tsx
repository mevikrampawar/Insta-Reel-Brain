import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Tag, X } from 'lucide-react'
import type { Reel, Collection } from '../types'

interface Props { reels: Reel[]; collections: Collection[]; onReelClick?: (reelId: string) => void }

interface Node { id: string; name: string; type: 'reel' | 'concept' | 'creator' | 'entity'; reelId?: string; x: number; y: number; vx: number; vy: number; val: number; color: string; conceptType?: string; entityType?: string; reelCount?: number; clusterX: number; clusterY: number }
interface Edge { source: string; target: string; weight: number }

const COLORS = { reel: '#6366f1', concept: '#10b981', creator: '#f59e0b', entity: '#ef4444' }

export function NeuralGraph({ reels, collections, onReelClick }: Props) {
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
  const frameCount = useRef(0)

  const { nodes, edges, clusterCenters } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const conceptMap = new Map<string, { node: Node; reels: Set<string> }>()
    const creatorMap = new Map<string, { node: Node; reels: Set<string> }>()
    const entityMap = new Map<string, { node: Node; reels: Set<string> }>()

    const completeReels = reels.filter(r => r.ingestStatus === 'complete')

    // Build collection membership map: reelId → collection names
    const reelCollections = new Map<string, string[]>()
    for (const col of collections) {
      for (const rid of (col.reelIds || [])) {
        const existing = reelCollections.get(rid) || []
        existing.push(col.name)
        reelCollections.set(rid, existing)
      }
    }

    // Create cluster centers from collections
    const collectionNames = [...new Set(collections.map(c => c.name))]
    const clusterCenters = new Map<string, { x: number; y: number }>()
    const angleStep = (Math.PI * 2) / Math.max(collectionNames.length, 1)
    const clusterRadius = 250
    collectionNames.forEach((name, i) => {
      clusterCenters.set(name, {
        x: Math.cos(angleStep * i) * clusterRadius,
        y: Math.sin(angleStep * i) * clusterRadius,
      })
    })

    // Unclustered nodes go to center
    const centerCluster = { x: 0, y: 0 }

    for (const reel of completeReels) {
      const rid = `reel-${reel.id}`
      const colNames = reelCollections.get(reel.id) || []
      const cluster = colNames.length > 0 ? clusterCenters.get(colNames[0]) || centerCluster : centerCluster

      nodes.push({
        id: rid, name: reel.title?.slice(0, 25) || 'Untitled', type: 'reel', reelId: reel.id,
        x: cluster.x + (Math.random() - 0.5) * 80, y: cluster.y + (Math.random() - 0.5) * 80,
        vx: 0, vy: 0, val: 5, color: COLORS.reel,
        clusterX: cluster.x, clusterY: cluster.y,
      })

      if (reel.creatorHandle) {
        const cid = `creator-${reel.creatorHandle.toLowerCase()}`
        if (!creatorMap.has(cid)) {
          const node: Node = {
            id: cid, name: `@${reel.creatorHandle}`, type: 'creator',
            x: cluster.x + (Math.random() - 0.5) * 60, y: cluster.y + (Math.random() - 0.5) * 60,
            vx: 0, vy: 0, val: 3, color: COLORS.creator, reelCount: 0,
            clusterX: cluster.x, clusterY: cluster.y,
          }
          creatorMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        creatorMap.get(cid)!.reels.add(rid)
        creatorMap.get(cid)!.node.reelCount = (creatorMap.get(cid)!.node.reelCount || 0) + 1
        edges.push({ source: rid, target: cid, weight: 0.3 })
      }

      for (const e of reel.entities || []) {
        const eid = `entity-${e.name.toLowerCase()}`
        if (!entityMap.has(eid)) {
          const node: Node = {
            id: eid, name: e.name, type: 'entity', entityType: e.type,
            x: centerCluster.x + (Math.random() - 0.5) * 100, y: centerCluster.y + (Math.random() - 0.5) * 100,
            vx: 0, vy: 0, val: 2, color: COLORS.entity,
            clusterX: centerCluster.x, clusterY: centerCluster.y,
          }
          entityMap.set(eid, { node, reels: new Set() })
          nodes.push(node)
        }
        entityMap.get(eid)!.reels.add(rid)
        edges.push({ source: rid, target: eid, weight: 0.2 })
      }

      for (const c of reel.concepts || []) {
        const cid = `concept-${c.conceptName}`
        if (!conceptMap.has(cid)) {
          const node: Node = {
            id: cid, name: c.conceptName, type: 'concept', conceptType: c.conceptType,
            x: centerCluster.x + (Math.random() - 0.5) * 100, y: centerCluster.y + (Math.random() - 0.5) * 100,
            vx: 0, vy: 0, val: 2, color: COLORS.concept,
            clusterX: centerCluster.x, clusterY: centerCluster.y,
          }
          conceptMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        conceptMap.get(cid)!.reels.add(rid)
        edges.push({ source: rid, target: cid, weight: c.weight || 0.4 })
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
          if (weight > 0.15) edges.push({ source: idA, target: idB, weight: weight * 0.5 })
        }
      }
    }

    return { nodes, edges, clusterCenters }
  }, [reels, collections])

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
      if (node.type === 'reel' && onReelClick && node.reelId) { onReelClick(node.reelId); return }
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
        if (node.type === 'reel' && onReelClick && node.reelId) { onReelClick(node.reelId); tapRef.current = null; return }
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
          if (!node) { setSelectedNode(null); setHighlighted(new Set()) }
        }
      }
      tapRef.current = null
    }
    dragRef.current = null
    pinchRef.current = null
  }, [findNodeAt])

  const zoomIn = useCallback(() => { cameraRef.current.zoom = Math.min(4, cameraRef.current.zoom * 1.3) }, [])
  const zoomOut = useCallback(() => { cameraRef.current.zoom = Math.max(0.2, cameraRef.current.zoom / 1.3) }, [])
  const resetView = useCallback(() => { cameraRef.current = { x: 0, y: 0, zoom: 1 } }, [])

  // Render loop — throttled simulation (every 3rd frame)
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
      frameCount.current++

      // Throttle simulation: only run physics every 3rd frame
      if (frameCount.current % 3 === 0) {
        // Edge forces
        for (const e of edges) {
          const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
          if (!s || !t) continue
          const dx = t.x - s.x, dy = t.y - s.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (dist - 100) * 0.004 * e.weight
          s.vx += (dx / dist) * force; s.vy += (dy / dist) * force
          t.vx -= (dx / dist) * force; t.vy -= (dy / dist) * force
        }

        // Cluster gravity: pull nodes toward their cluster center
        for (const n of nodes) {
          const dx = n.clusterX - n.x
          const dy = n.clusterY - n.y
          n.vx += dx * 0.008
          n.vy += dy * 0.008
        }

        // Repulsion — only between nearby nodes (spatial hash optimization)
        const cellSize = 100
        const grid = new Map<string, Node[]>()
        for (const n of nodes) {
          const cx = Math.floor(n.x / cellSize)
          const cy = Math.floor(n.y / cellSize)
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const key = `${cx + dx},${cy + dy}`
              if (!grid.has(key)) grid.set(key, [])
              grid.get(key)!.push(n)
            }
          }
        }
        for (const n of nodes) {
          const cx = Math.floor(n.x / cellSize)
          const cy = Math.floor(n.y / cellSize)
          const key = `${cx},${cy}`
          const neighbors = grid.get(key) || []
          for (const m of neighbors) {
            if (n === m) continue
            const dx = m.x - n.x, dy = m.y - n.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            if (dist < 80) {
              const force = -60 / (dist * dist)
              n.vx += (dx / dist) * force
              n.vy += (dy / dist) * force
            }
          }
        }

        // Apply velocity
        for (const n of nodes) {
          n.vx *= 0.82; n.vy *= 0.82
          n.x += n.vx; n.y += n.vy
        }
      }

      // Draw
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(cam.x, cam.y)
      ctx.scale(cam.zoom, cam.zoom)

      const hasHighlight = highlighted.size > 0

      // Draw cluster backgrounds
      for (const [name, center] of clusterCenters) {
        const col = collections.find(c => c.name === name)
        if (!col) continue
        ctx.globalAlpha = 0.04
        ctx.fillStyle = col.color || '#6366f1'
        ctx.beginPath()
        ctx.arc(center.x, center.y, 180, 0, Math.PI * 2)
        ctx.fill()

        // Cluster label
        ctx.globalAlpha = 0.2
        ctx.fillStyle = col.color || '#6366f1'
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(name, center.x, center.y - 190)
      }

      // Edges
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        const bothHighlighted = hasHighlight && highlighted.has(e.source) && highlighted.has(e.target)
        const alpha = hasHighlight ? (bothHighlighted ? 0.5 : 0.03) : Math.min(e.weight * 0.4, 0.3)

        ctx.globalAlpha = alpha
        ctx.strokeStyle = '#3f3f46'
        ctx.lineWidth = e.weight * 1.2
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
      }

      // Nodes
      for (const n of nodes) {
        const isReel = n.type === 'reel'
        const isCreator = n.type === 'creator'
        const r = isReel ? 8 : isCreator ? 6 : 5
        const dimmed = hasHighlight && !highlighted.has(n.id)
        const isSelected = selectedNode?.id === n.id

        ctx.globalAlpha = dimmed ? 0.08 : 1

        // Glow
        ctx.fillStyle = n.color
        ctx.beginPath()
        if (isCreator) {
          ctx.moveTo(n.x, n.y - r - 3)
          ctx.lineTo(n.x + r + 3, n.y)
          ctx.lineTo(n.x, n.y + r + 3)
          ctx.lineTo(n.x - r - 3, n.y)
          ctx.closePath()
        } else {
          ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2)
        }
        ctx.globalAlpha = dimmed ? 0.02 : (isSelected ? 0.2 : 0.1)
        ctx.fill()

        // Node body
        ctx.globalAlpha = dimmed ? 0.1 : 1
        ctx.fillStyle = n.color
        ctx.beginPath()
        if (isCreator) {
          ctx.moveTo(n.x, n.y - r)
          ctx.lineTo(n.x + r, n.y)
          ctx.lineTo(n.x, n.y + r)
          ctx.lineTo(n.x - r, n.y)
          ctx.closePath()
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

        // Labels
        if (showLabels && !dimmed && (isReel || isCreator)) {
          ctx.globalAlpha = 1
          ctx.fillStyle = '#d4d4d8'
          ctx.font = isReel ? 'bold 9px Inter, sans-serif' : '8px Inter, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(n.name, n.x, n.y - r - 5)
        }
      }

      ctx.restore()
      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(frame); resizeObs.disconnect() }
  }, [nodes, edges, showLabels, highlighted, selectedNode, clusterCenters, collections])

  // Detail panel data
  const relatedReels = useMemo(() => {
    if (!selectedNode) return []
    if (selectedNode.type === 'reel' && selectedNode.reelId) {
      const reel = reels.find(r => r.id === selectedNode.reelId)
      return reel ? [reel] : []
    }
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

      {tooltip.node && !selectedNode && (
        <div className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-xl max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          <p className="font-medium text-white truncate">{tooltip.node.name}</p>
          <p className="text-zinc-400 capitalize mt-0.5">
            {tooltip.node.type === 'reel' ? 'Reel' : tooltip.node.type === 'creator' ? `Creator · ${tooltip.node.reelCount || 0} reels` : tooltip.node.type === 'entity' ? `Entity · ${tooltip.node.entityType || ''}` : tooltip.node.conceptType || 'Concept'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomIn size={16} /></button>
        <button onClick={zoomOut} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomOut size={16} /></button>
        <button onClick={resetView} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><Maximize2 size={16} /></button>
        <button onClick={() => setShowLabels(!showLabels)} className={`w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center transition-colors ${showLabels ? 'text-indigo-400 border-indigo-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}><Tag size={16} /></button>
      </div>

      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan</p>
        {onReelClick && <p className="text-indigo-400">Tap blue node to view reel</p>}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.reel }} /><span className="text-zinc-400">Reel</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rotate-45" style={{ background: COLORS.creator }} /><span className="text-zinc-400">Creator</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.entity }} /><span className="text-zinc-400">Entity</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.concept }} /><span className="text-zinc-400">Concept</span></div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-16 md:w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{selectedNode.name}</p>
              <p className="text-[11px] text-zinc-500 capitalize">
                {selectedNode.type === 'reel' ? 'Reel' : selectedNode.type === 'creator' ? `Creator · ${selectedNode.reelCount || 0} reels` : selectedNode.type === 'entity' ? `Entity · ${selectedNode.entityType || ''}` : selectedNode.conceptType || 'Concept'}
              </p>
            </div>
            <button onClick={() => { setSelectedNode(null); setHighlighted(new Set()) }} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"><X size={14} /></button>
          </div>
          {relatedReels.length > 0 && (
            <div className="p-3 max-h-60 overflow-auto">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                {selectedNode.type === 'reel' ? 'Details' : `Connected Reels (${relatedReels.length})`}
              </p>
              <div className="space-y-1.5">
                {relatedReels.map(r => (
                  <button key={r.id} onClick={() => onReelClick?.(r.id)}
                    className="w-full text-left px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors">
                    <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                    <p className="text-[10px] text-zinc-500 truncate">@{r.creatorHandle || 'unknown'} · {r.suggestedTags?.slice(0, 3).join(', ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
