import { useMemo, useRef, useEffect } from 'react'
import type { Reel } from '../types'

interface Props { reels: Reel[] }

interface Node { id: string; name: string; type: 'reel' | 'concept'; x: number; y: number; vx: number; vy: number; val: number; color: string }
interface Edge { source: string; target: string; weight: number }

const COLORS = { reel: '#6366f1', topic: '#10b981', skill: '#f59e0b', person: '#ef4444', brand: '#ec4899', tool: '#06b6d4', framework: '#8b5cf6', trend: '#f97316' }

export function NeuralGraph({ reels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const conceptMap = new Map<string, string>()

    for (const reel of reels.filter(r => r.ingestStatus === 'complete')) {
      const rid = `reel-${reel.id}`
      nodes.push({ id: rid, name: reel.title?.slice(0, 30) || 'Untitled', type: 'reel', x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 3, color: COLORS.reel })

      for (const c of reel.concepts || []) {
        const cid = `concept-${c.conceptName}`
        if (!conceptMap.has(cid)) {
          conceptMap.set(cid, cid)
          nodes.push({ id: cid, name: c.conceptName, type: 'concept', x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 2, color: COLORS[c.conceptType as keyof typeof COLORS] || '#71717a' })
        }
        edges.push({ source: rid, target: cid, weight: c.weight || 0.5 })
      }
    }

    return { nodes, edges }
  }, [reels])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.parentElement?.clientWidth || 900
    const H = canvas.parentElement?.clientHeight || 600
    canvas.width = W
    canvas.height = H

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    let frame: number

    const draw = () => {
      // Force simulation
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        const dx = t.x - s.x, dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 150) * 0.002 * e.weight
        s.vx += (dx / dist) * force; s.vy += (dy / dist) * force
        t.vx -= (dx / dist) * force; t.vy -= (dy / dist) * force
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.0005
        n.vy += (H / 2 - n.y) * 0.0005
        n.vx *= 0.9; n.vy *= 0.9
        n.x += n.vx; n.y += n.vy
        n.x = Math.max(30, Math.min(W - 30, n.x))
        n.y = Math.max(30, Math.min(H - 30, n.y))
      }

      // Draw
      ctx.clearRect(0, 0, W, H)

      // Edges
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = '#3f3f46'
      ctx.lineWidth = 1
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
      }

      // Nodes
      ctx.globalAlpha = 1
      for (const n of nodes) {
        const r = n.type === 'reel' ? 8 : 6
        ctx.fillStyle = n.color
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#d4d4d8'
        ctx.font = n.type === 'reel' ? 'bold 10px Inter, sans-serif' : '9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(n.name, n.x, n.y - r - 4)
      }

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [nodes, edges])

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        {Object.entries(COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: v }} />
            <span className="text-zinc-400 capitalize">{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
