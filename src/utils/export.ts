import type { Reel } from '../types'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sanitizeCsvValue(val: string): string {
  // Prevent CSV injection in Excel/Sheets by prefixing formula-like values
  const safe = val.replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(safe)) return `'${safe}`
  return `"${safe}"`
}

export function downloadCSV(reels: Reel[]) {
  const h = ['URL', 'Title', 'Creator', 'Caption', 'Summary', 'Takeaways', 'Tags', 'Transcript', 'Created']
  const rows = reels.map(r => [r.url, r.title || '', r.creatorHandle || '', r.caption || '', r.summary || '', r.keyTakeaways.join('; '), r.suggestedTags.join(', '), r.transcript || '', new Date(r.createdAt).toISOString()])
  const csv = [h.join(','), ...rows.map(r => r.map(c => sanitizeCsvValue(c || '')).join(','))].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv' }), `reel-brain-${new Date().toISOString().split('T')[0]}.csv`)
}

export function downloadJSON(reels: Reel[]) {
  triggerDownload(new Blob([JSON.stringify(reels, null, 2)], { type: 'application/json' }), `reel-brain-${new Date().toISOString().split('T')[0]}.json`)
}
