import { useMemo, useRef, useEffect } from 'react'
import type { Reel } from '../types'

interface Props { reels: Reel[] }

interface Node { id: string; name: string; type: 'reel' | 'concept'; x: number; y: number; vx: number; vy: number; val: number; color: string }
interface Edge { source: string; target: string; weight: number }

const COLORS = { reel: '#6366f1', topic: '#10b981', skill: '#f59e0b', person: '#ef4444', brand: '#ec4899', tool: '#06b6d4', framework: '#8b5cf6', trend: '#f97316' }

export function NeuralGraph({ reels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const conceptMap = new Map<string, { node: Node; reels: Set<string> }>()

    const completeReels = reels.filter(r => r.ingestStatus === 'complete')

    for (const reel of completeReels) {
      const rid = `reel-${reel.id}`
      nodes.push({ id: rid, name: reel.title?.slice(0, 30) || 'Untitled', type: 'reel', x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 3, color: COLORS.reel })

      for (const c of reel.concepts || []) {
        const cid = `concept-${c.conceptName}`
        if (!conceptMap.has(cid)) {
          const node: Node = { id: cid, name: c.conceptName, type: 'concept', x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, val: 2, color: COLORS[c.conceptType as keyof typeof COLORS] || '#71717a' }
          conceptMap.set(cid, { node, reels: new Set() })
          nodes.push(node)
        }
        conceptMap.get(cid)!.reels.add(rid)
        edges.push({ source: rid, target: cid, weight: c.weight || 0.5 })
      }
    }

    // Add concept-concept edges based on co-occurrence in reels
    const conceptEntries = Array.from(conceptMap.entries())
    for (let i = 0; i < conceptEntries.length; i++) {
      for (let j = i + 1; j < conceptEntries.length; j++) {
        const [idA, dataA] = conceptEntries[i]
        const [idB, dataB] = conceptEntries[j]
        const sharedReels = [...dataA.reels].filter(r => dataB.reels.has(r))
        if (sharedReels.length >= 2) {
          // Weight = Jaccard similarity of shared reels
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

      // Repulsion between all nodes
      for (const n of nodes) {
        for (const m of nodes) {
          if (n === m) continue
          const dx = m.x - n.x, dy = m.y - n.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 100) {
            const force = -50 / (dist * dist)
            n.vx += (dx / dist) * force
            n.vy += (dy / dist) * force
          }
        }
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
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
        if (!s || !t) continue
        ctx.globalAlpha = Math.min(e.weight * 0.5, 0.4)
        ctx.strokeStyle = s.type === 'concept' && t.type === 'concept' ? '#6366f1' : '#3f3f46'
        ctx.lineWidth = e.weight * 2
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
    return () => {
      cancelAnimationFrame(frame)
      resizeObs.disconnect()
    }
  }, [nodes, edges])

  return (
    <div ref={containerRef} className="relative w-full h-full">
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
