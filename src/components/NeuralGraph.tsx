import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import cytoscape from 'cytoscape'
import { ZoomIn, ZoomOut, Maximize2, X, Network } from 'lucide-react'
import type { Reel, Collection } from '../types'

interface Props { reels: Reel[]; collections: Collection[]; onReelClick?: (reelId: string) => void }

const COLORS = {
  primaryCategory: '#8b5cf6',
  subCategory: '#6366f1',
  reel: '#4f46e5',
  crossLink: '#f59e0b',
  edge: '#27272a',
  edgeCross: '#422006',
}

function computeSimilarity(a: Reel, b: Reel): number {
  const tagsA = new Set(a.suggestedTags || [])
  const tagsB = new Set(b.suggestedTags || [])
  const entitiesA = new Set((a.entities || []).map(e => e.name.toLowerCase()))
  const entitiesB = new Set((b.entities || []).map(e => e.name.toLowerCase()))
  const conceptsA = new Set((a.concepts || []).map(c => c.conceptName.toLowerCase()))
  const conceptsB = new Set((b.concepts || []).map(c => c.conceptName.toLowerCase()))

  const allA = new Set([...tagsA, ...entitiesA, ...conceptsA])
  const allB = new Set([...tagsB, ...entitiesB, ...conceptsB])
  if (allA.size === 0 && allB.size === 0) return 0

  let intersection = 0
  for (const item of allA) if (allB.has(item)) intersection++
  return intersection / (allA.size + allB.size - intersection)
}

function buildElements(reels: Reel[], collections: Collection[]) {
  const complete = reels.filter(r => r.ingestStatus === 'complete')
  const elements: cytoscape.ElementDefinition[] = []

  // Build hierarchy: primaryCategory → contentCategory → reels
  // Also use collections as an alternative grouping
  const primaryMap = new Map<string, Map<string, Reel[]>>()

  for (const reel of complete) {
    const primary = reel.primaryCategory || 'Uncategorized'
    const sub = reel.contentCategory || 'other'
    if (!primaryMap.has(primary)) primaryMap.set(primary, new Map())
    const subMap = primaryMap.get(primary)!
    if (!subMap.has(sub)) subMap.set(sub, [])
    subMap.get(sub)!.push(reel)
  }

  // Also check collections for additional grouping
  const collectionReels = new Map<string, Reel[]>()
  for (const col of collections) {
    if (col.isAuto && col.reelIds.length > 0) {
      collectionReels.set(col.name, col.reelIds.map(id => complete.find(r => r.id === id)).filter(Boolean) as Reel[])
    }
  }

  // Create primary category nodes (Level 1)
  for (const [primary, subMap] of primaryMap) {
    const totalReels = [...subMap.values()].reduce((s, arr) => s + arr.length, 0)
    elements.push({
      group: 'nodes',
      data: {
        id: `pcat-${primary}`,
        label: primary.charAt(0).toUpperCase() + primary.slice(1),
        type: 'primaryCategory',
        reelCount: totalReels,
      },
    })

    // Create sub-category nodes (Level 2)
    for (const [sub, subReels] of subMap) {
      const subId = `subcat-${primary}-${sub}`
      elements.push({
        group: 'nodes',
        data: {
          id: subId,
          label: sub.charAt(0).toUpperCase() + sub.slice(1),
          type: 'subCategory',
          reelCount: subReels.length,
          parent: `pcat-${primary}`,
        },
      })

      // Create reel nodes (Level 3) inside sub-categories
      for (const reel of subReels) {
        const rid = `reel-${reel.id}`
        elements.push({
          group: 'nodes',
          data: {
            id: rid,
            label: (reel.title || 'Untitled').slice(0, 25),
            type: 'reel',
            reelId: reel.id,
            parent: subId,
          },
        })
      }
    }
  }

  // Cross-category similarity links (reels in different primary categories)
  const crossLinks: { source: string; target: string; weight: number }[] = []
  const primaryCategories = [...primaryMap.keys()]

  for (let i = 0; i < primaryCategories.length; i++) {
    for (let j = i + 1; j < primaryCategories.length; j++) {
      const reelsA = [...primaryMap.get(primaryCategories[i])!.values()].flat()
      const reelsB = [...primaryMap.get(primaryCategories[j])!.values()].flat()

      for (const a of reelsA) {
        let bestMatch: Reel | null = null
        let bestScore = 0
        for (const b of reelsB) {
          const score = computeSimilarity(a, b)
          if (score > bestScore) { bestScore = score; bestMatch = b }
        }
        if (bestScore >= 0.3 && bestMatch) {
          crossLinks.push({ source: `reel-${a.id}`, target: `reel-${bestMatch.id}`, weight: bestScore })
        }
      }
    }
  }

  // Limit cross-links: keep top connections per reel (max 2)
  const perReel = new Map<string, typeof crossLinks>()
  for (const link of crossLinks) {
    if (!perReel.has(link.source)) perReel.set(link.source, [])
    if (!perReel.has(link.target)) perReel.set(link.target, [])
    perReel.get(link.source)!.push(link)
    perReel.get(link.target)!.push({ ...link, source: link.target, target: link.source })
  }

  const addedCrossEdges = new Set<string>()
  for (const [, links] of perReel) {
    const top = links.sort((a, b) => b.weight - a.weight).slice(0, 2)
    for (const link of top) {
      const edgeId = [link.source, link.target].sort().join('__')
      if (!addedCrossEdges.has(edgeId)) {
        addedCrossEdges.add(edgeId)
        elements.push({
          group: 'edges',
          data: {
            id: `cross-${edgeId}`,
            source: link.source,
            target: link.target,
            weight: link.weight,
            crossLink: true,
          },
        })
      }
    }
  }

  return elements
}

function getGraphStyle(showLabels: boolean): cytoscape.StylesheetCSS[] {
  const label = showLabels ? 'data(label)' : ''
  return [
    {
      selector: 'node[type="primaryCategory"]',
      css: {
        'background-color': COLORS.primaryCategory,
        'background-opacity': 0.15,
        'border-color': COLORS.primaryCategory,
        'border-width': 2,
        'shape': 'round-rectangle',
        'label': label,
        'color': '#c4b5fd',
        'font-size': '13px',
        'font-weight': 'bold',
        'text-valign': 'center',
        'text-halign': 'center',
        'padding': '40px',
        'text-margin-y': 0,
      },
    },
    {
      selector: 'node[type="subCategory"]',
      css: {
        'background-color': COLORS.subCategory,
        'background-opacity': 0.1,
        'border-color': COLORS.subCategory,
        'border-width': 1.5,
        'border-style': 'dashed',
        'shape': 'round-rectangle',
        'label': label,
        'color': '#818cf8',
        'font-size': '11px',
        'font-weight': 'bold' as const,
        'text-valign': 'center',
        'text-halign': 'center',
        'padding': '25px',
        'text-margin-y': 0,
      },
    },
    {
      selector: 'node[type="reel"]',
      css: {
        'background-color': COLORS.reel,
        'width': 10,
        'height': 10,
        'label': label,
        'color': '#a5b4fc',
        'font-size': '8px',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-wrap': 'wrap',
        'text-max-width': '70px',
      },
    },
    {
      selector: 'edge[^crossLink]',
      css: {
        'line-color': COLORS.edge,
        'width': 1,
        'opacity': 0.3,
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[crossLink]',
      css: {
        'line-color': COLORS.crossLink,
        'width': 1.5,
        'opacity': 0.5,
        'line-style': 'dashed',
        'curve-style': 'bezier',
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
      css: { 'opacity': 0.08 },
    },
    {
      selector: 'edge.dimmed',
      css: { 'opacity': 0.02 },
    },
  ]
}

export function NeuralGraph({ reels, collections, onReelClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const onReelClickRef = useRef(onReelClick)
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; type: string; reelCount?: number } | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const initializedRef = useRef(false)
  const elementIdsRef = useRef<Set<string>>(new Set())

  const elements = useMemo(() => buildElements(reels, collections), [reels, collections])

  useEffect(() => { onReelClickRef.current = onReelClick }, [onReelClick])

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.15,
      maxZoom: 4,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
      style: getGraphStyle(showLabels),
    })

    elementIdsRef.current = new Set(elements.map(e => e.data.id).filter(Boolean) as string[])

    // Run hierarchical layout after init
    cy.layout({
      name: 'breadthfirst',
      roots: elements.filter(e => e.data.type === 'primaryCategory').map(e => `#${e.data.id}`),
      directed: true,
      spacingFactor: 1.2,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      animate: true,
      animationDuration: 600,
      padding: 50,
    } as cytoscape.LayoutOptions).run()

    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const type = node.data('type')
      const reelId = node.data('reelId')

      if (type === 'reel' && reelId && onReelClickRef.current) {
        onReelClickRef.current(reelId)
        return
      }

      const label = node.data('label')
      const reelCount = node.data('reelCount')
      setSelectedNode({ id: node.id(), label, type, reelCount })

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

    return () => {
      cy.destroy()
      cyRef.current = null
      initializedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync elements add/remove
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const newIds = new Set(elements.map(e => e.data.id).filter(Boolean) as string[])
    const oldIds = elementIdsRef.current

    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        const ele = cy.getElementById(oldId)
        if (ele.length > 0) cy.remove(ele)
      }
    }

    const toAdd = elements.filter(e => e.data.id && !oldIds.has(e.data.id))
    if (toAdd.length > 0) {
      cy.add(toAdd as cytoscape.ElementDefinition[])
      // Re-run layout for all nodes to maintain hierarchy
      cy.layout({
        name: 'breadthfirst',
        roots: elements.filter(e => e.data.type === 'primaryCategory').map(e => `#${e.data.id}`),
        directed: true,
        spacingFactor: 1.2,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true,
        animate: false,
        padding: 50,
      } as cytoscape.LayoutOptions).run()
    }

    elementIdsRef.current = newIds
  }, [elements])

  // Sync label visibility
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.style().fromJson(getGraphStyle(showLabels)).update()
  }, [showLabels])

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

  const fitView = useCallback(() => { cyRef.current?.fit(undefined, 50) }, [])

  const connectedReels = useMemo(() => {
    if (!selectedNode) return []
    const cy = cyRef.current
    if (!cy) return []

    if (selectedNode.type === 'reel') {
      const reelId = selectedNode.id.replace('reel-', '')
      const reel = reels.find(r => r.id === reelId)
      return reel ? [reel] : []
    }

    // For categories, get all connected reels
    const connected = cy.getElementById(selectedNode.id).neighborhood('node[type="reel"]')
    const reelIds = connected.map(n => n.data('reelId')).filter(Boolean)
    return reels.filter(r => reelIds.includes(r.id)).slice(0, 8)
  }, [selectedNode, reels])

  // Stats for the info panel
  const graphStats = useMemo(() => {
    const complete = reels.filter(r => r.ingestStatus === 'complete')
    const cats = new Set(complete.map(r => r.primaryCategory).filter(Boolean))
    return { totalReels: complete.length, categories: cats.size }
  }, [reels])

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

      {/* Instructions */}
      <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 space-y-0.5 pointer-events-none">
        <p>Scroll to zoom · Drag to pan</p>
        <p className="text-purple-400">Purple = categories · Indigo = reels</p>
        <p className="text-amber-400">Dashed lines = cross-category similarity</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs space-y-1 hidden sm:block">
        <p className="font-medium text-zinc-300 mb-1">Legend</p>
        <div className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm" style={{ background: COLORS.primaryCategory, opacity: 0.5 }} /><span className="text-zinc-400">Category</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm border border-dashed" style={{ borderColor: COLORS.subCategory }} /><span className="text-zinc-400">Sub-category</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.reel }} /><span className="text-zinc-400">Reel</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-px border-t border-dashed" style={{ borderColor: COLORS.crossLink }} /><span className="text-zinc-400">Similarity</span></div>
      </div>

      {/* Graph stats */}
      <div className="absolute bottom-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-500 pointer-events-none hidden sm:block">
        <div className="flex items-center gap-1.5"><Network size={10} className="text-purple-400" /> {graphStats.categories} categories · {graphStats.totalReels} reels</div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-16 md:w-72 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{selectedNode.label}</p>
              <p className="text-[11px] text-zinc-500 capitalize">
                {selectedNode.type.replace(/([A-Z])/g, ' $1').trim()}
                {selectedNode.reelCount ? ` · ${selectedNode.reelCount} reels` : ''}
              </p>
            </div>
            <button onClick={clearSelection}
              className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"><X size={14} /></button>
          </div>
          {connectedReels.length > 0 && (
            <div className="p-3 max-h-60 overflow-auto">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                {selectedNode.type === 'reel' ? 'Details' : `Reels (${connectedReels.length})`}
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
