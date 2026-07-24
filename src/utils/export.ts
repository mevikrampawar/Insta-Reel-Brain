import type { Reel } from '../types'

export function downloadCSV(reels: Reel[]) {
  const h = ['URL', 'Title', 'Creator', 'Caption', 'Summary', 'Takeaways', 'Tags', 'Transcript', 'Created']
  const rows = reels.map(r => [r.url, r.title || '', r.creatorHandle || '', r.caption || '', r.summary || '', r.keyTakeaways.join('; '), r.suggestedTags.join(', '), r.transcript || '', new Date(r.createdAt).toISOString()])
  const csv = [h.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `reel-brain-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export function downloadJSON(reels: Reel[]) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(reels, null, 2)], { type: 'application/json' }))
  a.download = `reel-brain-${new Date().toISOString().split('T')[0]}.json`
  a.click()
}
