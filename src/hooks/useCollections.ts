import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Collection } from '../types'

const getUserCollections = (uid: string) => collection(db, 'users', uid, 'collections')

const AUTO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48']

// Context-aware category mappings: maps individual tags/concepts to broader themes
const CATEGORY_MAP: Record<string, string[]> = {
  'AI & Machine Learning': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'chatgpt', 'gpt', 'llm', 'large language model', 'claude', 'openai', 'anthropic', 'midjourney', 'stable diffusion', 'generative ai', 'nlp', 'natural language processing', 'computer vision', 'tensorflow', 'pytorch', 'hugging face', 'transformer', 'bert', 'prompt engineering', 'ai agent', 'ai tool'],
  'Fitness & Health': ['fitness', 'workout', 'exercise', 'gym', 'strength training', 'cardio', 'weight loss', 'muscle', 'nutrition', 'diet', 'health', 'wellness', 'yoga', 'running', ' HIIT', 'protein', 'calories', 'bodybuilding', 'fat loss', 'flexibility', ' recovery'],
  'Programming': ['javascript', 'python', 'typescript', 'react', 'node', 'coding', 'programming', 'developer', 'software', 'web development', 'frontend', 'backend', 'full stack', 'api', 'database', 'sql', 'git', 'docker', 'kubernetes', 'aws', 'cloud', 'devops', 'html', 'css', 'rust', 'golang', 'java', 'c++', 'swift'],
  'Business & Marketing': ['business', 'marketing', 'entrepreneur', 'startup', 'sales', 'brand', 'social media', 'content creation', 'seo', 'advertising', 'e-commerce', 'dropshipping', 'affiliate', 'passive income', 'side hustle', 'freelance', 'agency', 'client', 'revenue', 'profit', 'growth hacking'],
  'Productivity': ['productivity', 'time management', 'efficiency', 'habit', 'routine', 'organization', 'planning', 'goal setting', 'motivation', 'discipline', 'focus', 'deep work', 'procrastination', 'workflow', 'automation', 'notion', 'calendar', 'journaling'],
  'Finance': ['finance', 'investing', 'stock', 'crypto', 'bitcoin', 'ethereum', 'trading', 'budget', 'saving', 'wealth', 'money', 'financial freedom', 'real estate', 'portfolio', 'dividend', 'index fund', '401k', 'ira', 'tax'],
  'Design & Creative': ['design', 'ui', 'ux', 'figma', 'photoshop', 'illustrator', 'video editing', 'animation', 'graphic design', 'typography', 'color theory', 'logo', 'branding', 'creative', 'art', 'photography', 'cinematography'],
  'Content Creation': ['youtube', 'tiktok', 'instagram', 'reels', 'content', 'creator', 'influencer', 'viral', 'editing', 'camera', 'lighting', 'audio', 'podcast', 'newsletter', 'blogging', 'copywriting', 'storytelling'],
  'Mindset & Self-improvement': ['mindset', 'self improvement', 'personal development', 'confidence', 'mental health', 'anxiety', 'meditation', 'philosophy', 'stoicism', 'gratitude', 'journaling', 'therapy', 'emotional intelligence', 'EQ', 'resilience', 'growth mindset'],
  'Food & Cooking': ['cooking', 'recipe', 'food', 'kitchen', 'meal prep', 'baking', 'chef', 'cuisine', 'restaurant', 'nutrition', 'vegan', 'vegetarian', 'protein', 'healthy eating'],
}

// Content category from AI analysis → broader collection name
const CONTENT_CATEGORY_MAP: Record<string, string> = {
  'educational': 'Learning & Education',
  'instructional': 'How-To & Tutorials',
  'motivational': 'Motivation & Inspiration',
  'review': 'Reviews & Comparisons',
  'storytelling': 'Stories & Narratives',
  'entertainment': 'Entertainment',
  'news': 'News & Trends',
}

function mapToCategory(text: string): string | null {
  const lower = text.toLowerCase().trim()
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw) || kw.includes(lower)) return category
    }
  }
  return null
}

export function useCollections(userId: string | undefined) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) { setCollections([]); setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(query(getUserCollections(userId), orderBy('createdAt', 'desc')))
      setCollections(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
      }))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const addCollection = useCallback(async (data: Partial<Collection>) => {
    if (!userId) return
    await addDoc(getUserCollections(userId), {
      ...data,
      userId,
      reelIds: data.reelIds || [],
      isAuto: data.isAuto || false,
      createdAt: Date.now(),
    })
    await fetch()
  }, [userId, fetch])

  const deleteCollection = useCallback(async (id: string) => {
    if (!userId) return
    await deleteDoc(doc(db, 'users', userId, 'collections', id))
    await fetch()
  }, [userId, fetch])

  const addReelToCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayUnion(reelId) })
    await fetch()
  }, [userId, fetch])

  const autoAssignCollections = useCallback(async (reelId: string, tags: string[], concepts: { conceptName: string; conceptType: string }[], contentCategory?: string) => {
    if (!userId) return

    // Fresh read from Firestore
    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
    })

    // Map tags and concepts to broader categories
    const categoryNames = new Set<string>()

    // 1. Use AI content category first
    if (contentCategory && CONTENT_CATEGORY_MAP[contentCategory]) {
      categoryNames.add(CONTENT_CATEGORY_MAP[contentCategory])
    }

    // 2. Map tags to broader categories
    for (const tag of tags.slice(0, 5)) {
      const cat = mapToCategory(tag)
      if (cat) categoryNames.add(cat)
    }

    // 3. Map concepts to broader categories
    for (const c of concepts.slice(0, 5)) {
      const cat = mapToCategory(c.conceptName)
      if (cat) categoryNames.add(cat)
    }

    // 4. If nothing matched, create one generic collection from the most specific tag
    if (categoryNames.size === 0) {
      const fallback = tags[0] || concepts[0]?.conceptName
      if (fallback) categoryNames.add(fallback.toLowerCase().trim())
    }

    if (categoryNames.size === 0) return

    let colorIdx = existing.length

    for (const name of categoryNames) {
      const existingAuto = existing.find(c => c.name.toLowerCase() === name)

      if (existingAuto) {
        const reelIds = existingAuto.reelIds || []
        if (!reelIds.includes(reelId)) {
          try {
            await updateDoc(doc(db, 'users', userId, 'collections', existingAuto.id), {
              reelIds: arrayUnion(reelId)
            })
          } catch { /* skip */ }
        }
      } else {
        try {
          await addDoc(getUserCollections(userId), {
            userId,
            name,
            description: 'Auto-generated from reel content',
            color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
            reelIds: [reelId],
            isAuto: true,
            createdAt: Date.now(),
          })
          colorIdx++
        } catch { /* skip */ }
      }
    }

    await fetch()
  }, [userId, fetch])

  const retroactiveAutoAssign = useCallback(async (reels: { id: string; suggestedTags: string[]; concepts: { conceptName: string; conceptType: string }[]; contentCategory?: string }[]) => {
    if (!userId) return { processed: 0, assigned: 0 }

    // Fresh read from Firestore
    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
    })

    let processed = 0
    let assigned = 0
    let colorIdx = existing.length

    for (const reel of reels) {
      processed++

      const categoryNames = new Set<string>()

      if (reel.contentCategory && CONTENT_CATEGORY_MAP[reel.contentCategory]) {
        categoryNames.add(CONTENT_CATEGORY_MAP[reel.contentCategory])
      }

      for (const tag of reel.suggestedTags.slice(0, 5)) {
        const cat = mapToCategory(tag)
        if (cat) categoryNames.add(cat)
      }

      for (const c of reel.concepts.slice(0, 5)) {
        const cat = mapToCategory(c.conceptName)
        if (cat) categoryNames.add(cat)
      }

      if (categoryNames.size === 0) {
        const fallback = reel.suggestedTags[0] || reel.concepts[0]?.conceptName
        if (fallback) categoryNames.add(fallback.toLowerCase().trim())
      }

      if (categoryNames.size === 0) continue

      for (const name of categoryNames) {
        const existingAuto = existing.find(c => c.name.toLowerCase() === name)

        if (existingAuto) {
          const reelIds = existingAuto.reelIds || []
          if (!reelIds.includes(reel.id)) {
            try {
              await updateDoc(doc(db, 'users', userId, 'collections', existingAuto.id), {
                reelIds: arrayUnion(reel.id)
              })
              assigned++
            } catch { /* skip */ }
          }
        } else {
          try {
            const newCollection = await addDoc(getUserCollections(userId), {
              userId,
              name,
              description: 'Auto-generated from reel content',
              color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
              reelIds: [reel.id],
              isAuto: true,
              createdAt: Date.now(),
            })
            existing.push({
              id: newCollection.id,
              userId,
              name,
              description: 'Auto-generated from reel content',
              color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
              reelIds: [reel.id],
              isAuto: true,
              createdAt: Date.now(),
            })
            colorIdx++
            assigned++
          } catch { /* skip */ }
        }
      }
    }

    await fetch()
    return { processed, assigned }
  }, [userId, fetch])

  return { collections, loading, addCollection, deleteCollection, addReelToCollection, autoAssignCollections, retroactiveAutoAssign }
}
