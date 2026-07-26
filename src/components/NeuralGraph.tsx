import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
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

function buildElements(reels: Reel[], _collections: Collection[]) {
  const completeReels = reels.filter(r => r.ingestStatus === 'complete')
  const elements: cytoscape.ElementDefinition[] = []
  const addedCreators = new Set<string>()
  const addedEntities = new Set<string>()
  const addedConcepts = new Set<string>()
  const addedCategories = new Set<string>()

  const categories = [...new Set(completeReels.map(r => r.primaryCategory).filter(Boolean))] as string[]

  for (const cat of categories) {
    if (!addedCategories.has(cat!)) {
      addedCategories.add(cat!)
      elements.push({
        group: 'nodes',
        data: { id: `cat-${cat}`, label: cat, type: 'category' },
        classes: 'category',
      })
    }
  }

  for (const reel of completeReels) {
    const rid = `reel-${reel.id}`
    const cat = reel.primaryCategory || 'Uncategorized'

    if (!addedCategories.has(cat)) {
      addedCategories.add(cat)
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
        data: { id: `${rid}-${cid}`, source: rid, target: cid },
      })
    }

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
        data: { id: `${rid}-${eid}`, source: rid, target: eid },
      })
    }

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
        data: { id: `${rid}-${cid}`, source: rid, target: cid },
      })
    }
  }

  return elements
}

function getGraphStyle(showLabels: boolean): any[] {
  const label = showLabels ? 'data(label)' : ''
  return [
    {
      selector: 'node.category',
      css: {
        'background-color': '#18181b',
        'background-opacity': 0.6,
        'border-color': '#27272a',
        'border-width': 1,
        'shape': 'round-rectangle',
        'label': label,
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
      css: {
        'background-color': NODE_COLORS.reel,
        'width': 12,
        'height': 12,
        'label': label,
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
      css: {
        'background-color': NODE_COLORS.creator,
        'shape': 'diamond',
        'width': 14,
        'height': 14,
        'label': label,
        'color': '#d4d4d8',
        'font-size': '8px',
        'text-valign': 'bottom',
        'text-margin-y': 6,
      },
    },
    {
      selector: 'node.entity',
      css: {
        'background-color': NODE_COLORS.entity,
        'shape': 'round-rectangle',
        'width': 10,
        'height': 10,
        'label': label,
        'color': '#a1a1aa',
        'font-size': '7px',
        'text-valign': 'bottom',
        'text-margin-y': 5,
      },
    },
    {
      selector: 'node.concept',
      css: {
        'background-color': NODE_COLORS.concept,
        'shape': 'ellipse',
        'width': 9,
        'height': 9,
        'label': label,
        'color': '#a1a1aa',
        'font-size': '7px',
        'text-valign': 'bottom',
        'text-margin-y': 5,
      },
    },
    {
      selector: 'edge',
      css: {
        'line-color': '#3f3f46',
        'width': 1,
        'opacity': 0.4,
      },
    },
    {
      selector: 'node:selected',
      css: {
        'border-color': '#ffffff',
        'border-width': 2,
      },
    },
    {
      selector: '.highlighted',
      css: { 'opacity': 1 },
    },
    {
      selector: '.dimmed',
      css: { 'opacity': 0.1 },
    },
    {
      selector: 'edge.dimmed',
      css: { 'opacity': 0.03 },
    },
  ]
}

export function NeuralGraph({ reels, collections, onReelClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const onReelClickRef = useRef(onReelClick)
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; type: string; detail?: string } | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const initializedRef = useRef(false)
  const elementIdsRef = useRef<Set<string>>(new Set())

  const elements = useMemo(() => buildElements(reels, collections), [reels, collections])

  // Stable callback ref — prevents graph rebuilds when parent re-renders
  useEffect(() => { onReelClickRef.current = onReelClick }, [onReelClick])

  // Initialize cytoscape ONCE
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.2,
      maxZoom: 4,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
      style: getGraphStyle(showLabels),
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

    // Store initial element IDs
    elementIdsRef.current = new Set(elements.map(e => e.data.id).filter(Boolean) as string[])

    // Click handlers — use refs to avoid stale closures
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const type = node.data('type')
      const label = node.data('label')
      const detail = node.data('detail')
      const reelId = node.data('reelId')

      if (type === 'reel' && reelId && onReelClickRef.current) {
        onReelClickRef.current(reelId)
        return
      }

      setSelectedNode({ id: node.id(), label, type, detail })

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

    return () => {
      cy.destroy()
      cyRef.current = null
      initializedRef.current = false
    }
  }, []) // Empty deps — run ONCE

  // Sync elements: add/remove without destroying the graph
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const newIds = new Set(elements.map(e => e.data.id).filter(Boolean) as string[])
    const oldIds = elementIdsRef.current

    // Remove elements that no longer exist
    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        const ele = cy.getElementById(oldId)
        if (ele.length > 0) cy.remove(ele)
      }
    }

    // Add new elements
    const toAdd = elements.filter(e => e.data.id && !oldIds.has(e.data.id))
    if (toAdd.length > 0) {
      cy.add(toAdd as any)
      // Run layout only for new nodes
      const newNodes = cy.nodes().filter(n => toAdd.some(e => e.data.id === n.id()))
      if (newNodes.length > 0) {
        newNodes.layout({
          name: 'cose',
          idealEdgeLength: () => 120,
          nodeRepulsion: () => 6000,
          gravity: 0.3,
          numIter: 200,
          animate: false,
          padding: 40,
        } as any).run()
      }
    }

    elementIdsRef.current = newIds
  }, [elements])

  // Sync label visibility WITHOUT rebuilding graph
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.style().fromJson(getGraphStyle(showLabels)).update()
  }, [showLabels])

  // Clear selection on background click
  const clearSelection = useCallback(() => {
    setSelectedNode(null)
    cyRef.current?.elements().removeClass('dimmed highlighted')
  }, [])

  const zoomIn = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const w = containerRef.current?.clientWidth || 900
    const h = containerRef.current?.clientHeight || 600
    cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: w / 2, y: h / 2 } })
  }, [])

  const zoomOut = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const w = containerRef.current?.clientWidth || 900
    const h = containerRef.current?.clientHeight || 600
    cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: w / 2, y: h / 2 } })
  }, [])

  const fitView = useCallback(() => { cyRef.current?.fit(undefined, 40) }, [])

  const connectedReels = useMemo(() => {
    if (!selectedNode) return []
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
  }, [selectedNode, reels])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" onClick={(e) => {
        if (e.target === containerRef.current) clearSelection()
      }} />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomIn size={16} /></button>
        <button onClick={zoomOut} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ZoomOut size={16} /></button>
        <button onClick={fitView} className="w-9 h-9 bg-zinc-900/90 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><Maximize2 size={16} /></button>
        <button onClick={() => setShowLabels(s => !s)}
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
        <div className="absolute bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-16 md:w-72 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{selectedNode.label}</p>
              <p className="text-[11px] text-zinc-500 capitalize">{selectedNode.type}{selectedNode.detail ? ` · ${selectedNode.detail}` : ''}</p>
            </div>
            <button onClick={clearSelection}
              className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"><X size={14} /></button>
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
