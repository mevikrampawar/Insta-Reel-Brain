import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import type { Reel } from '../types'

interface Props { reels: Reel[]; onReelClick?: (reelId: string) => void }

interface Node { id: string; name: string; type: 'reel' | 'concept'; reelId?: string; x: number; y: number; vx: number; vy: number; val: number; color: string; conceptType?: string }
interface Edge { source: string; target: string; weight: number }

const COLORS = { reel: '#6366f1', topic: '#10b981', skill: '#f59e0b', person: '#ef4444', brand: '#ec4899', tool: '#06b6d4', framework: '#8b5cf6', trend: '#f97316' }

export function NeuralGraph({ reels, onReelClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<Node[]>([])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: Node | null }>({ x: 0, y: 0, node: null })

  // Pan & zoom state
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const conceptMap = new Map<string, { node: Node; reels: Set<string> }>()

    const completeReels = reels.filter(r => r.ingestStatus === 'complete')

    for (const reel of completeReels) {
      const rid = `reel-${reel.id}`
      // Reel nodes are larger and more prominent
      nodes.push({ id: rid, name: reel.title?.slice(0, 25) || 'Untitled', type: 'reel', reelId: reel.id, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 5, color: COLORS.reel })

      for (const c of reel.concepts || []) {
        const cid = `concept-${c.conceptName}`
        if (!conceptMap.has(cid)) {
          const node: Node = { id: cid, name: c.conceptName, type: 'concept', conceptType: c.conceptType, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 3, color: COLORS[c.conceptType as keyof typeof COLORS] || '#71717a' }
          conceptMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        conceptMap.get(cid)!.reels.add(rid)
        edges.push({ source: rid, target: cid, weight: c.weight || 0.5 })
      }
    }

    // Concept-concept edges based on co-occurrence
    const conceptEntries = Array.from(conceptMap.entries())
    for (let i = 0; i < conceptEntries.length; i++) {
      for (let j = i + 1; j < conceptEntries.length; j++) {
        const [idA, dataA] = conceptEntries[i]
        const [idB, dataB] = conceptEntries[j]
        const sharedReels = [...dataA.reels].filter(r => dataB.reels.has(r))
        if (sharedReels.length >= 2) {
          const union = new Set([...dataA.reels, ...dataB.reels]).size
          const weight = sharedReels.length / union
          if (weight > 0.2) {
            edges.push({ source: idA, target: idB, weight: weight * 0.6 })
          }
        }
      }
    }

    return { nodes, edges }
  }, [reels])

  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Screen coords → world coords
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cam = cameraRef.current
    return {
      x: (sx - cam.x) / cam.zoom,
      y: (sy - cam.y) / cam.zoom,
    }
  }, [])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    // Check if clicking a reel node
    if (onReelClick) {
      const world = screenToWorld(sx, sy)
      for (const n of nodesRef.current) {
        if (n.type !== 'reel' || !n.reelId) continue
        const r = 12
        if (Math.abs(n.x - world.x) < r && Math.abs(n.y - world.y) < r) {
          onReelClick(n.reelId)
          return
        }
      }
    }

    // Start pan
    dragRef.current = { startX: e.clientX, startY: e.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y }
  }, [onReelClick, screenToWorld])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    // Panning
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      cameraRef.current.x = dragRef.current.camX + dx
      cameraRef.current.y = dragRef.current.camY + dy
      return
    }

    // Hover detection
    const world = screenToWorld(sx, sy)
    let found: Node | null = null
    for (const n of nodesRef.current) {
      const r = n.type === 'reel' ? 12 : 8
      if (Math.abs(n.x - world.x) < r && Math.abs(n.y - world.y) < r) {
        found = n
        break
      }
    }
    setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY, node: found }))
  }, [screenToWorld])

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const cam = cameraRef.current
    const newZoom = Math.max(0.3, Math.min(3, cam.zoom * zoomFactor))

    // Zoom toward mouse position
    cam.x = sx - (sx - cam.x) * (newZoom / cam.zoom)
    cam.y = sy - (sy - cam.y) * (newZoom / cam.zoom)
    cam.zoom = newZoom
  }, [])

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

      // Repulsion between all nodes
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

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.0003
        n.vy += (H / 2 - n.y) * 0.0003
        n.vx *= 0.85; n.vy *= 0.85
        n.x += n.vx; n.y += n.vy
      }

      // Draw with camera transform
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(cam.x, cam.y)
      ctx.scale(cam.zoom, cam.zoom)

      // Edges with glow
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue

        const alpha = Math.min(e.weight * 0.6, 0.5)
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
      ctx.globalAlpha = 1
      for (const n of nodes) {
        const isReel = n.type === 'reel'
        const r = isReel ? 10 : 7

        // Glow
        ctx.globalAlpha = 0.15
        ctx.fillStyle = n.color
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2); ctx.fill()

        // Node
        ctx.globalAlpha = 1
        ctx.fillStyle = n.color
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill()

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.beginPath(); ctx.arc(n.x - r * 0.25, n.y - r * 0.25, r * 0.4, 0, Math.PI * 2); ctx.fill()

        // Label
        ctx.fillStyle = '#d4d4d8'
        ctx.font = isReel ? 'bold 10px Inter, sans-serif' : '9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(n.name, n.x, n.y - r - 6)
      }

      ctx.restore()

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(frame)
      resizeObs.disconnect()
    }
  }, [nodes, edges])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setTooltip(prev => ({ ...prev, node: null })) }}
        onWheel={handleWheel}
      />

      {/* Tooltip */}
      {tooltip.node && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-xl max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-medium text-white truncate">{tooltip.node.name}</p>
          <p className="text-zinc-400 capitalize mt-0.5">
            {tooltip.node.type === 'reel' ? 'Reel' : tooltip.node.conceptType || 'Concept'}
          </p>
          {tooltip.node.type === 'reel' && onReelClick && (
            <p className="text-indigo-400 mt-1">Click to view in Library</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        {Object.entries(COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: v }} />
            <span className="text-zinc-400 capitalize">{k}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-1">
        <p>Scroll to zoom · Drag to pan</p>
        {onReelClick && <p className="text-indigo-400">Click blue node to view reel</p>}
      </div>
    </div>
  )
}
