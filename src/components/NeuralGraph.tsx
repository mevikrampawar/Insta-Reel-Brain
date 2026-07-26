import { useEffect, useRef, useCallback, useState } from 'react'
import cytoscape from 'cytoscape'
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'
import type { Reel, Collection } from '../types'

interface Props { reels: Reel[]; collections: Collection[]; onReelClick?: (reelId: string) => void }

const NODE_COLORS: Record<string, string> = {
  reel: '#6366f1',
  creator: '#f59e0b',
  entity: '#ef4444',
  concept: '#10b981',
}

export function NeuralGraph({ reels, collections, onReelClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; type: string; detail?: string } | null>(null)
  const [showLabels, setShowLabels] = useState(true)

  const buildGraph = useCallback(() => {
    if (!containerRef.current) return
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }

    const completeReels = reels.filter(r => r.ingestStatus === 'complete')
    const elements: cytoscape.ElementDefinition[] = []

    // Build reel → category map
    const reelCategory = new Map<string, string>()
    for (const reel of completeReels) {
      if (reel.primaryCategory) reelCategory.set(reel.id, reel.primaryCategory)
    }

    // Get unique categories
    const categories = [...new Set(completeReels.map(r => r.primaryCategory).filter(Boolean))]

    // Create compound parent nodes (one per category)
    for (const cat of categories) {
      elements.push({
        group: 'nodes',
        data: { id: `cat-${cat}`, label: cat, type: 'category' },
        classes: 'category',
      })
    }

    // Track nodes we've already added
    const addedCreators = new Set<string>()
    const addedEntities = new Set<string>()
    const addedConcepts = new Set<string>()

    for (const reel of completeReels) {
      const rid = `reel-${reel.id}`
      const cat = reel.primaryCategory || 'Uncategorized'

      // Ensure parent exists
      if (!elements.find(e => e.data.id === `cat-${cat}`)) {
        elements.push({
          group: 'nodes',
          data: { id: `cat-${cat}`, label: cat, type: 'category' },
          classes: 'category',
        })
      }

      elements.push({
        group: 'nodes',
        data: {
          id: rid,
          label: (reel.title || 'Untitled').slice(0, 30),
          type: 'reel',
          reelId: reel.id,
          parent: `cat-${cat}`,
        },
        classes: 'reel',
      })

      // Creator node (not parented — shared across categories)
      if (reel.creatorHandle) {
        const cid = `creator-${reel.creatorHandle.toLowerCase()}`
        if (!addedCreators.has(cid)) {
          addedCreators.add(cid)
          elements.push({
            group: 'nodes',
            data: { id: cid, label: `@${reel.creatorHandle}`, type: 'creator' },
            classes: 'creator',
          })
        }
        elements.push({
          group: 'edges',
          data: { id: `${rid}-${cid}`, source: rid, target: cid, weight: 0.3 },
        })
      }

      // Entity nodes
      for (const e of (reel.entities || []).slice(0, 5)) {
        const eid = `entity-${e.name.toLowerCase()}`
        if (!addedEntities.has(eid)) {
          addedEntities.add(eid)
          elements.push({
            group: 'nodes',
            data: { id: eid, label: e.name, type: 'entity', detail: e.type },
            classes: 'entity',
          })
        }
        elements.push({
          group: 'edges',
          data: { id: `${rid}-${eid}`, source: rid, target: eid, weight: 0.2 },
        })
      }

      // Concept nodes
      for (const c of (reel.concepts || []).slice(0, 5)) {
        const cid = `concept-${c.conceptName}`
        if (!addedConcepts.has(cid)) {
          addedConcepts.add(cid)
          elements.push({
            group: 'nodes',
            data: { id: cid, label: c.conceptName, type: 'concept', detail: c.conceptType },
            classes: 'concept',
          })
        }
        elements.push({
          group: 'edges',
          data: { id: `${rid}-${cid}`, source: rid, target: cid, weight: c.weight || 0.4 },
        })
      }
    }

    // Concept co-occurrence edges
    const conceptReels = new Map<string, Set<string>>()
    for (const el of elements) {
      if (el.group === 'edges' && el.data.source.startsWith('concept-') && el.data.target.startsWith('reel-')) {
        const set = conceptReels.get(el.data.source) || new Set()
        set.add(el.data.target)
        conceptReels.set(el.data.source, set)
      }
    }
    // Also check reel→concept edges
    for (const el of elements) {
      if (el.group === 'edges' && el.data.source.startsWith('reel-') && el.data.target.startsWith('concept-')) {
        const set = conceptReels.get(el.data.target) || new Set()
        set.add(el.data.source)
        conceptReels.set(el.data.target, set)
      }
    }
    const conceptIds = [...conceptReels.keys()]
    for (let i = 0; i < conceptIds.length; i++) {
      for (let j = i + 1; j < conceptIds.length; j++) {
        const a = conceptReels.get(conceptIds[i])!
        const b = conceptReels.get(conceptIds[j])!
        const shared = [...a].filter(x => b.has(x)).length
        const union = new Set([...a, ...b]).size
        if (shared >= 2 && shared / union > 0.15) {
          elements.push({
            group: 'edges',
            data: { id: `${conceptIds[i]}-${conceptIds[j]}`, source: conceptIds[i], target: conceptIds[j], weight: 0.3 },
          })
        }
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.2,
      maxZoom: 4,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
      style: [
        {
          selector: 'node.category',
          style: {
            'background-color': '#18181b',
            'background-opacity': 0.6,
            'border-color': '#27272a',
            'border-width': 1,
            'shape': 'round-rectangle',
            'label': showLabels ? 'data(label)' : '',
            'color': '#71717a',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': 8,
            'padding': '30px',
          },
        },
        {
          selector: 'node.reel',
          style: {
            'background-color': NODE_COLORS.reel,
            'width': 12,
            'height': 12,
            'label': showLabels ? 'data(label)' : '',
            'color': '#d4d4d8',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': '80px',
          },
        },
        {
          selector: 'node.creator',
          style: {
            'background-color': NODE_COLORS.creator,
            'shape': 'diamond',
            'width': 14,
            'height': 14,
            'label': showLabels ? 'data(label)' : '',
            'color': '#d4d4d8',
            'font-size': '8px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'node.entity',
          style: {
            'background-color': NODE_COLORS.entity,
            'shape': 'round-rectangle',
            'width': 10,
            'height': 10,
            'label': showLabels ? 'data(label)' : '',
            'color': '#a1a1aa',
            'font-size': '7px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
          },
        },
        {
          selector: 'node.concept',
          style: {
            'background-color': NODE_COLORS.concept,
            'shape': 'ellipse',
            'width': 9,
            'height': 9,
            'label': showLabels ? 'data(label)' : '',
            'color': '#a1a1aa',
            'font-size': '7px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#3f3f46',
            'width': 1,
            'opacity': 0.4,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ffffff',
            'border-width': 2,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'opacity': 1,
          },
        },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.1,
          },
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.03,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: () => 120,
        nodeOverlap: 30,
        nodeRepulsion: () => 6000,
        edgeElasticity: () => 100,
        gravity: 0.3,
        numIter: 500,
        animate: true,
        animationDuration: 800,
        padding: 40,
      },
    })

    // Click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const type = node.data('type')
      const label = node.data('label')
      const detail = node.data('detail')
      const reelId = node.data('reelId')

      if (type === 'reel' && reelId && onReelClick) {
        onReelClick(reelId)
        return
      }

      setSelectedNode({ id: node.id(), label, type, detail })

      // Highlight neighborhood
      const neighborhood = node.neighborhood().add(node)
      cy.elements().addClass('dimmed')
      neighborhood.removeClass('dimmed')
      neighborhood.addClass('highlighted')
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null)
        cy.elements().removeClass('dimmed highlighted')
      }
    })

    cyRef.current = cy
  }, [reels, collections, showLabels, onReelClick])

  useEffect(() => {
    buildGraph()
    return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null } }
  }, [buildGraph])

  const zoomIn = useCallback(() => { cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.3, renderedPosition: { x: (containerRef.current?.clientWidth || 900) / 2, y: (containerRef.current?.clientHeight || 600) / 2 } }) }, [])
  const zoomOut = useCallback(() => { cyRef.current?.zoom({ level: cyRef.current.zoom() / 1.3, renderedPosition: { x: (containerRef.current?.clientWidth || 900) / 2, y: (containerRef.current?.clientHeight || 600) / 2 } }) }, [])
  const fitView = useCallback(() => { cyRef.current?.fit(undefined, 40) }, [])

  const connectedReels = selectedNode ? (() => {
    if (selectedNode.type === 'reel') {
      const reelId = selectedNode.id.replace('reel-', '')
      const reel = reels.find(r => r.id === reelId)
      return reel ? [reel] : []
    }
    const cy = cyRef.current
    if (!cy) return []
    const connected = cy.getElementById(selectedNode.id).neighborhood('node[type="reel"]')
    const reelIds = connected.map(n => n.data('reelId')).filter(Boolean)
    return reels.filter(r => reelIds.includes(r.id)).slice(0, 5)
  })() : []

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomIn size={16} /></button>
        <button onClick={zoomOut} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomOut size={16} /></button>
        <button onClick={fitView} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><Maximize2 size={16} /></button>
        <button onClick={() => setShowLabels(!showLabels)}
          className={`w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${showLabels ? 'text-indigo-400 border-indigo-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          Aa
        </button>
      </div>

      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan</p>
        {onReelClick && <p className="text-indigo-400">Click purple node to view reel</p>}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.reel }} /><span className="text-zinc-400">Reel</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rotate-45" style={{ background: NODE_COLORS.creator }} /><span className="text-zinc-400">Creator</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: NODE_COLORS.entity }} /><span className="text-zinc-400">Entity</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.concept }} /><span className="text-zinc-400">Concept</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm border border-zinc-700 bg-zinc-800/50" /><span className="text-zinc-400">Category</span></div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-16 md:w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{selectedNode.label}</p>
              <p className="text-[11px] text-zinc-500 capitalize">{selectedNode.type}{selectedNode.detail ? ` · ${selectedNode.detail}` : ''}</p>
            </div>
            <button onClick={() => {
              setSelectedNode(null)
              cyRef.current?.elements().removeClass('dimmed highlighted')
            }} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"><X size={14} /></button>
          </div>
          {connectedReels.length > 0 && (
            <div className="p-3 max-h-60 overflow-auto">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                {selectedNode.type === 'reel' ? 'Details' : `Connected Reels (${connectedReels.length})`}
              </p>
              <div className="space-y-1.5">
                {connectedReels.map(r => (
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
