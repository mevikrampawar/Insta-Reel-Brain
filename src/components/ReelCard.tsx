import { useState } from 'react'
import { ExternalLink, Tag, Clock, Trash2, ChevronDown, ChevronUp, AlertCircle, FolderPlus, StickyNote, Heart, MessageCircle, Play, Eye, Music, MapPin, Users, Shield, BookOpen, Package, Wrench, User, Globe, Smartphone, GraduationCap, Star, RefreshCw } from 'lucide-react'
import type { Reel, Collection } from '../types'
import { useNotes } from '../hooks/useNotes'
import { Notes } from './Notes'
import { computeQualityScore, getQualityLabel, getQualityColor } from '../utils/quality'
import { formatCount, hashColor } from '../utils/format'

interface Props {
  reel: Reel
  userId: string
  onDelete: (id: string) => void
  collections?: Collection[]
  onAddToCollection?: (reelId: string, collectionId: string) => void
  onReAnalyze?: (id: string) => void
}

function formatDuration(sec: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}

export function ReelCard({ reel, userId, onDelete, collections, onAddToCollection, onReAnalyze }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const { notes, addNote, updateNote, deleteNote } = useNotes(userId, reel.id)

  // Failed state
  if (reel.ingestStatus === 'failed') {
    return (
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 min-w-0">
            <AlertCircle size={16} className="shrink-0" />
            <span className="text-sm font-medium truncate">{reel.title || reel.url}</span>
          </div>
          <button onClick={() => onDelete(reel.id)} className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 p-1">
            <Trash2 size={14} />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{reel.errorMessage}</p>
      </div>
    )
  }

  // Processing state
  if (reel.ingestStatus !== 'complete') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="w-4 h-4 rounded-full bg-indigo-500/30 shrink-0" />
          <span className="text-sm">Processing: {reel.title || reel.url}...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* === TOP SECTION: Creator + Title + Summary === */}
      <div className="p-4">
        {/* Row 1: Creator info */}
        {reel.creatorHandle && (
          <div className="flex items-center gap-2 mb-2">
            {/* Avatar placeholder */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: hashColor(reel.creatorHandle) }}
            >
              {reel.creatorHandle[0]?.toUpperCase()}
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-medium text-zinc-300 truncate">@{reel.creatorHandle}</span>
              {reel.creatorVerified && <Shield size={10} className="text-blue-400 shrink-0" />}
              {reel.creatorFollowers > 0 && (
                <span className="text-[10px] text-zinc-600 shrink-0">· {formatCount(reel.creatorFollowers)}</span>
              )}
            </div>
            {/* Right: link + actions */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {reel.url && reel.url !== 'manual-entry' && (
                <a href={reel.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-zinc-600 hover:text-indigo-400 transition-colors rounded-lg"
                  title="Open original">
                  <ExternalLink size={13} />
                </a>
              )}
              {onReAnalyze && (
                <button onClick={() => onReAnalyze(reel.id)}
                  className="p-1.5 text-zinc-600 hover:text-amber-400 transition-colors rounded-lg"
                  title="Re-analyze">
                  <RefreshCw size={13} />
                </button>
              )}
              <button onClick={() => setShowNotes(!showNotes)}
                className={`p-1.5 rounded-lg transition-colors ${showNotes ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}
                title="Notes">
                <StickyNote size={13} />
              </button>
              {collections && collections.length > 0 && (
                <button onClick={() => setShowCollections(!showCollections)}
                  className={`p-1.5 rounded-lg transition-colors ${showCollections ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-600 hover:text-indigo-400'}`}
                  title="Add to collection">
                  <FolderPlus size={13} />
                </button>
              )}
              <button onClick={() => onDelete(reel.id)}
                className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors rounded-lg"
                title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Row 2: Title */}
        <h3 className="font-semibold text-sm leading-snug mb-1.5">{reel.title || 'Untitled Reel'}</h3>

        {/* Row 3: Summary */}
        {reel.summary && (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-3">{reel.summary}</p>
        )}

        {/* Row 4: Tags + Concepts — compact single line */}
        {(reel.suggestedTags.length > 0 || reel.concepts?.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {reel.suggestedTags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px]">
                <Tag size={8} />{tag}
              </span>
            ))}
            {reel.concepts?.slice(0, 2).map(c => (
              <span key={c.conceptName} className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">
                {c.conceptName}
              </span>
            ))}
            {(reel.suggestedTags.length > 3 || (reel.concepts?.length || 0) > 2) && (
              <span className="text-[10px] text-zinc-600">+{reel.suggestedTags.length - 3 + Math.max(0, (reel.concepts?.length || 0) - 2)} more</span>
            )}
          </div>
        )}

        {/* Row 5: Engagement metrics — compact single row */}
        <div className="flex items-center gap-3 flex-wrap">
          {reel.likeCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Heart size={10} className="shrink-0" /> {formatCount(reel.likeCount)}
            </span>
          )}
          {reel.commentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <MessageCircle size={10} className="shrink-0" /> {formatCount(reel.commentCount)}
            </span>
          )}
          {reel.playCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Play size={10} className="shrink-0" /> {formatCount(reel.playCount)}
            </span>
          )}
          {reel.viewCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Eye size={10} className="shrink-0" /> {formatCount(reel.viewCount)}
            </span>
          )}
          {reel.durationSec > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock size={10} className="shrink-0" /> {formatDuration(reel.durationSec)}
            </span>
          )}
          {reel.audioTrack && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500 min-w-0">
              <Music size={10} className="shrink-0" /> <span className="truncate max-w-[100px]">{reel.audioTrack}</span>
            </span>
          )}
          {(() => {
            const qs = computeQualityScore(reel).overall
            return (
              <span className={`flex items-center gap-1 text-[11px] ${getQualityColor(qs)}`}>
                <Star size={10} className="shrink-0" /> {getQualityLabel(qs)}
              </span>
            )
          })()}
          {/* Content Category */}
          {reel.contentCategory && reel.contentCategory !== 'other' && (
            <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] capitalize">{reel.contentCategory}</span>
          )}
          {/* Sentiment */}
          {reel.sentiment && reel.sentiment !== 'neutral' && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              reel.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
              reel.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
              'bg-yellow-500/10 text-yellow-400'
            }`}>{reel.sentiment}</span>
          )}
          {/* If no metrics at all, show date */}
          {reel.likeCount === 0 && reel.commentCount === 0 && reel.playCount === 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
              <Clock size={10} className="shrink-0" /> {new Date(reel.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* === COLLECTION PICKER === */}
      {showCollections && collections && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Add to collection</p>
          <div className="flex flex-wrap gap-1.5">
            {collections.map(c => {
              const inCollection = c.reelIds?.includes(reel.id)
              return (
                <button key={c.id}
                  onClick={() => !inCollection && onAddToCollection?.(reel.id, c.id)}
                  disabled={inCollection}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    inCollection
                      ? 'bg-zinc-700/50 text-zinc-400 cursor-default'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 active:scale-95'
                  }`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  {c.name}
                  {inCollection && <span className="text-emerald-400 text-[10px]">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* === NOTES === */}
      {showNotes && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <Notes notes={notes} reelTitle={reel.title} onAdd={addNote} onUpdate={updateNote} onDelete={deleteNote} />
        </div>
      )}

      {/* === EXPANDABLE DETAILS === */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-zinc-800/50 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors">
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Less details' : 'More details'}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
          {/* Caption */}
          {reel.caption && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Caption</p>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{reel.caption}</p>
            </div>
          )}

          {/* Hashtags */}
          {reel.hashtags?.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Hashtags</p>
              <div className="flex flex-wrap gap-1">
                {reel.hashtags.map(h => (
                  <span key={h} className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">#{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Mentions + Location + Tagged — combined row */}
          {(reel.mentions?.length > 0 || reel.location || reel.taggedUsers?.length > 0) && (
            <div className="space-y-1.5">
              {reel.mentions?.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="text-purple-400">@</span> {reel.mentions.join(', ')}
                </div>
              )}
              {reel.location && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <MapPin size={11} className="shrink-0" /> {reel.location}
                </div>
              )}
              {reel.taggedUsers?.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users size={11} className="shrink-0" /> {reel.taggedUsers.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Key Takeaways */}
          {reel.keyTakeaways.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Key Takeaways</p>
              <ul className="space-y-1.5">
                {reel.keyTakeaways.map((t, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex gap-2">
                    <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {reel.actionItems?.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Action Items</p>
              <ul className="space-y-1.5">
                {reel.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {reel.entities?.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Mentioned</p>
              <div className="flex flex-wrap gap-1.5">
                {reel.entities.map((entity, i) => {
                  const icon = entity.type === 'book' ? BookOpen :
                    entity.type === 'product' ? Package :
                    entity.type === 'tool' ? Wrench :
                    entity.type === 'person' ? User :
                    entity.type === 'app' ? Smartphone :
                    entity.type === 'course' ? GraduationCap :
                    entity.type === 'website' ? Globe : Tag
                  const Icon = icon
                  return (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg text-[11px] text-zinc-300">
                      <Icon size={10} className="shrink-0 text-zinc-500" />
                      {entity.name}
                      <span className="text-[9px] text-zinc-600 capitalize">{entity.type}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Target Audience */}
          {reel.targetAudience && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Target Audience</p>
              <p className="text-xs text-zinc-400">{reel.targetAudience}</p>
            </div>
          )}

          {/* Transcript */}
          {reel.transcript && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Transcript</p>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-40 overflow-auto bg-zinc-800/30 rounded-lg p-3">{reel.transcript}</p>
            </div>
          )}

          {/* Top Comments */}
          {reel.topComments?.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Top Comments</p>
              <div className="space-y-2">
                {reel.topComments.map((c, i) => (
                  <div key={i} className="bg-zinc-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-zinc-300 leading-relaxed">{c.text}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">@{c.author} · {formatCount(c.likes)} likes</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata footer */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-600 flex-wrap pt-2 border-t border-zinc-800/50">
            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(reel.createdAt).toLocaleDateString()}</span>
            {reel.language && <span className="px-1.5 py-0.5 bg-zinc-800 rounded">{reel.language}</span>}
            {reel.isPaidPartnership && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Paid</span>}
            {reel.coauthors?.length > 0 && <span>Co: {reel.coauthors.join(', ')}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
