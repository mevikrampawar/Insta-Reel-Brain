import { motion, AnimatePresence } from 'motion/react'
import { X, Pause, Play, Square, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={isComplete ? onClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              {isComplete ? (
                <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  <X size={16} />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  {progress.isPaused ? (
                    <button onClick={onResume} className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors" title="Resume">
                      <Play size={14} />
                    </button>
                  ) : (
                    <button onClick={onPause} className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors" title="Pause">
                      <Pause size={14} />
                    </button>
                  )}
                  <button onClick={onCancel} className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors" title="Cancel">
                    <Square size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isComplete && progress.failed === 0 ? 'bg-emerald-500' : progress.failed > 0 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between mt-2.5 text-[11px] text-zinc-500">
              <span>{progress.done} of {progress.total} completed</span>
              {progress.failed > 0 && <span className="text-red-400">{progress.failed} failed</span>}
            </div>
          </div>

          {/* Rate limit note */}
          {rateLimitNote && (
            <div className="mx-5 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300/80 leading-relaxed">{rateLimitNote}</p>
            </div>
          )}

          {/* Job list */}
          <div className="max-h-48 overflow-y-auto px-5 pb-4 space-y-1">
            {progress.jobs.map(job => (
              <div key={job.id} className="flex items-center gap-2 py-1">
                {job.status === 'done' && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                {job.status === 'failed' && <XCircle size={12} className="text-red-400 shrink-0" />}
                {job.status === 'processing' && <Loader2 size={12} className="text-indigo-400 shrink-0 animate-spin" />}
                {job.status === 'cancelled' && <XCircle size={12} className="text-zinc-500 shrink-0" />}
                {job.status === 'pending' && <div className="w-3 h-3 rounded-full border border-zinc-600 shrink-0" />}
                <span className={`text-[11px] truncate ${
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

          {/* Footer */}
          {isComplete && (
            <div className="px-5 pb-5">
              <button onClick={onClose}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium transition-colors">
                Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
