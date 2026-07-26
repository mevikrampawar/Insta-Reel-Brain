import { useState } from 'react'
import { ExternalLink, Tag, Clock, Trash2, ChevronDown, ChevronUp, AlertCircle, FolderPlus, StickyNote, Heart, MessageCircle, Play, Eye, Music, MapPin, Users, Shield } from 'lucide-react'
import type { Reel, Collection } from '../types'
import { useNotes } from '../hooks/useNotes'
import { Notes } from './Notes'

interface Props {
  reel: Reel
  userId: string
  onDelete: (id: string) => void
  collections?: Collection[]
  onAddToCollection?: (reelId: string, collectionId: string) => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(sec: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}

export function ReelCard({ reel, userId, onDelete, collections, onAddToCollection }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const { notes, addNote, updateNote, deleteNote } = useNotes(userId, reel.id)

  if (reel.ingestStatus === 'failed') {
    return (
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Failed: {reel.title || reel.url}</span>
          </div>
          <button onClick={() => onDelete(reel.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{reel.errorMessage}</p>
      </div>
    )
  }

  if (reel.ingestStatus !== 'complete') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="w-4 h-4 rounded-full bg-indigo-500/30" />
          <span className="text-sm">Processing: {reel.title || reel.url}...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Thumbnail */}
          {reel.thumbnailUrl && (
            <div className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
              <img src={reel.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Title + link */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{reel.title}</h3>
              {reel.url && reel.url !== 'manual-entry' && (
                <a href={reel.url} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-indigo-400 shrink-0 transition-colors">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Creator */}
            {reel.creatorHandle && (
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs text-zinc-500">@{reel.creatorHandle}</p>
                {reel.creatorVerified && <Shield size={10} className="text-blue-400" />}
                {reel.creatorFollowers > 0 && (
                  <span className="text-[10px] text-zinc-600">· {formatCount(reel.creatorFollowers)} followers</span>
                )}
              </div>
            )}

            <p className="text-sm text-zinc-300 line-clamp-2">{reel.summary}</p>

            {/* Engagement row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {reel.likeCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Heart size={10} /> {formatCount(reel.likeCount)}
                </span>
              )}
              {reel.commentCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <MessageCircle size={10} /> {formatCount(reel.commentCount)}
                </span>
              )}
              {reel.playCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Play size={10} /> {formatCount(reel.playCount)}
                </span>
              )}
              {reel.viewCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Eye size={10} /> {formatCount(reel.viewCount)}
                </span>
              )}
              {reel.durationSec > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Clock size={10} /> {formatDuration(reel.durationSec)}
                </span>
              )}
              {reel.audioTrack && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Music size={10} /> {reel.audioTrack}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowNotes(!showNotes)}
              className={`p-1.5 rounded-lg transition-colors ${showNotes ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}
              title="Notes">
              <StickyNote size={14} />
            </button>
            {collections && collections.length > 0 && (
              <button onClick={() => setShowCollections(!showCollections)}
                className={`p-1.5 rounded-lg transition-colors ${showCollections ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-600 hover:text-indigo-400'}`}
                title="Add to collection">
                <FolderPlus size={14} />
              </button>
            )}
            <button onClick={() => onDelete(reel.id)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Tags */}
        {reel.suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {reel.suggestedTags.slice(0, 5).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        )}

        {/* Concepts */}
        {reel.concepts?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {reel.concepts.slice(0, 4).map(c => (
              <span key={c.conceptName} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs capitalize">
                {c.conceptType}: {c.conceptName}
              </span>
            ))}
          </div>
        )}

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {/* Add to collection dropdown */}
      {showCollections && collections && (
        <div className="border-t border-zinc-800 p-3">
          <p className="text-xs text-zinc-500 mb-2">Add to collection:</p>
          <div className="flex flex-wrap gap-2">
            {collections.map(c => {
              const inCollection = c.reelIds?.includes(reel.id)
              return (
                <button key={c.id}
                  onClick={() => !inCollection && onAddToCollection?.(reel.id, c.id)}
                  disabled={inCollection}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    inCollection
                      ? 'bg-zinc-700/50 text-zinc-400 cursor-default'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  {c.name}
                  {inCollection && <span className="text-emerald-400">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {showNotes && (
        <div className="border-t border-zinc-800 p-3">
          <Notes notes={notes} reelTitle={reel.title} onAdd={addNote} onUpdate={updateNote} onDelete={deleteNote} />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-3 text-sm">
          {/* Caption */}
          {reel.caption && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Caption</p>
              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{reel.caption}</p>
            </div>
          )}

          {/* Hashtags */}
          {reel.hashtags?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Hashtags</p>
              <div className="flex flex-wrap gap-1">
                {reel.hashtags.map(h => (
                  <span key={h} className="text-xs text-indigo-400">#{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Mentions */}
          {reel.mentions?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Mentions</p>
              <div className="flex flex-wrap gap-1">
                {reel.mentions.map(m => (
                  <span key={m} className="text-xs text-purple-400">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {reel.location && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <MapPin size={12} /> {reel.location}
            </div>
          )}

          {/* Tagged users */}
          {reel.taggedUsers?.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Users size={12} /> Tagged: {reel.taggedUsers.join(', ')}
            </div>
          )}

          {/* Key Takeaways */}
          {reel.keyTakeaways.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Key Takeaways</p>
              <ul className="space-y-1">
                {reel.keyTakeaways.map((t, i) => (
                  <li key={i} className="text-zinc-300 text-xs flex gap-2">
                    <span className="text-indigo-400">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {reel.transcript && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Transcript</p>
              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">{reel.transcript}</p>
            </div>
          )}

          {/* Top comments */}
          {reel.topComments?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Top Comments</p>
              <div className="space-y-1.5">
                {reel.topComments.map((c, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-zinc-300">{c.text}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">@{c.author} · {c.likes} likes</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata footer */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(reel.createdAt).toLocaleDateString()}</span>
            {reel.language && <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">{reel.language}</span>}
            {reel.isPaidPartnership && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Paid partnership</span>}
            {reel.coauthors?.length > 0 && <span>Co-authored: {reel.coauthors.join(', ')}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
