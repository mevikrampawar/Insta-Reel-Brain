import { motion, AnimatePresence } from 'motion/react'
import { X, Pause, Play, Square, CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { BatchProgress } from '../hooks/useBatchProcess'

interface Props {
  progress: BatchProgress
  title: string
  onClose: () => void
  onCancel: () => void
  onPause: () => void
  onResume: () => void
  rateLimitNote?: string
}

export function BatchProgressDialog({ progress, title, onClose, onCancel, onPause, onResume, rateLimitNote }: Props) {
  const percent = progress.total > 0 ? Math.round((progress.done + progress.failed) / progress.total * 100) : 0
  const isComplete = !progress.isRunning && progress.total > 0
  const [expanded, setExpanded] = useState(false)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 left-0 right-0 z-[60] pointer-events-auto"
      >
        <div className="mx-auto max-w-2xl bg-zinc-900 border border-zinc-700 shadow-2xl shadow-black/50">
          {/* Compact header */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Status icon */}
            <div className="shrink-0">
              {isComplete ? (
                progress.failed === 0
                  ? <CheckCircle2 size={16} className="text-emerald-400" />
                  : <AlertTriangle size={16} className="text-amber-400" />
              ) : (
                <Loader2 size={16} className="text-indigo-400 animate-spin" />
              )}
            </div>

            {/* Title + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">{title}</span>
                <span className="text-[11px] text-zinc-500 shrink-0">
                  {progress.done}/{progress.total}
                  {progress.failed > 0 && <span className="text-red-400 ml-1">{progress.failed} failed</span>}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
                <motion.div
                  className={`h-full rounded-full ${isComplete && progress.failed === 0 ? 'bg-emerald-500' : progress.failed > 0 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {!isComplete && (
                <>
                  {progress.isPaused ? (
                    <button onClick={onResume} className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors" title="Resume">
                      <Play size={13} />
                    </button>
                  ) : (
                    <button onClick={onPause} className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors" title="Pause">
                      <Pause size={13} />
                    </button>
                  )}
                  <button onClick={onCancel} className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors" title="Cancel">
                    <Square size={13} />
                  </button>
                </>
              )}
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title={expanded ? 'Collapse' : 'Expand'}>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {isComplete && (
                <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Dismiss">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {rateLimitNote && (
                  <div className="mx-4 mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-amber-300/80 leading-relaxed">{rateLimitNote}</p>
                  </div>
                )}
                <div className="max-h-32 overflow-y-auto px-4 pb-2.5 space-y-0.5">
                  {progress.jobs.map(job => (
                    <div key={job.id} className="flex items-center gap-2 py-0.5">
                      {job.status === 'done' && <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />}
                      {job.status === 'failed' && <XCircle size={10} className="text-red-400 shrink-0" />}
                      {job.status === 'processing' && <Loader2 size={10} className="text-indigo-400 shrink-0 animate-spin" />}
                      {job.status === 'cancelled' && <XCircle size={10} className="text-zinc-500 shrink-0" />}
                      {job.status === 'pending' && <div className="w-2.5 h-2.5 rounded-full border border-zinc-600 shrink-0" />}
                      <span className={`text-[10px] truncate ${
                        job.status === 'done' ? 'text-zinc-500' :
                        job.status === 'failed' ? 'text-red-400' :
                        job.status === 'processing' ? 'text-white' :
                        'text-zinc-500'
                      }`}>
                        {job.id.slice(0, 12)}…
                      </span>
                      {job.error && <span className="text-[9px] text-red-500 truncate ml-auto">{job.error}</span>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
