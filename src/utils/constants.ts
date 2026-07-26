export const CATEGORY_COLORS: Record<string, string> = {
  'AI & Technology': '#8b5cf6',
  'Fitness & Health': '#10b981',
  'Business & Marketing': '#f59e0b',
  'Programming & Development': '#3b82f6',
  'Productivity & Self-improvement': '#ec4899',
  'Finance & Investing': '#14b8a6',
  'Creative & Design': '#f97316',
  'Education & Learning': '#6366f1',
  'Lifestyle & Entertainment': '#ef4444',
  'Food & Cooking': '#84cc16',
  'Other': '#6b7280',
}

export const MAJOR_CATEGORIES = [
  'AI & Technology',
  'Fitness & Health',
  'Business & Marketing',
  'Programming & Development',
  'Productivity & Self-improvement',
  'Finance & Investing',
  'Creative & Design',
  'Education & Learning',
  'Lifestyle & Entertainment',
  'Food & Cooking',
] as const

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']
}
