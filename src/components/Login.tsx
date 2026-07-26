import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { Brain, Search, Network, MessageSquare, Sparkles, FolderOpen, ArrowRight, Zap, Shield, Globe, Code, Cpu, Eye } from 'lucide-react'

function CursorGlow() {
  const [pos, setPos] = useState({ x: -200, y: -200 })
  const [hasMouse, setHasMouse] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    setHasMouse(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setHasMouse(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!hasMouse) return
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [hasMouse])

  if (!hasMouse) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{
        background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(99,102,241,0.07), transparent 60%)`,
      }}
    />
  )
}

function GraphShowcase() {
  const nodes = [
    { id: 'root', x: 200, y: 140, r: 18, color: '#818cf8', label: 'Reel Brain' },
    { id: 'ai', x: 100, y: 70, r: 12, color: '#8b5cf6', label: 'AI & Tech' },
    { id: 'fitness', x: 300, y: 60, r: 10, color: '#10b981', label: 'Fitness' },
    { id: 'business', x: 340, y: 150, r: 10, color: '#f59e0b', label: 'Business' },
    { id: 'coding', x: 60, y: 130, r: 8, color: '#3b82f6', label: 'Coding' },
    { id: 'edu', x: 150, y: 220, r: 8, color: '#6366f1', label: 'Education' },
    { id: 'creative', x: 280, y: 230, r: 7, color: '#f97316', label: 'Creative' },
    { id: 'r1', x: 40, y: 180, r: 4, color: '#3b82f6', label: '' },
    { id: 'r2', x: 75, y: 200, r: 4, color: '#3b82f6', label: '' },
    { id: 'r3', x: 120, y: 30, r: 4, color: '#8b5cf6', label: '' },
    { id: 'r4', x: 80, y: 45, r: 3, color: '#8b5cf6', label: '' },
    { id: 'r5', x: 330, y: 35, r: 3, color: '#10b981', label: '' },
    { id: 'r6', x: 370, y: 80, r: 4, color: '#10b981', label: '' },
    { id: 'r7', x: 380, y: 180, r: 3, color: '#f59e0b', label: '' },
    { id: 'r8', x: 310, y: 200, r: 3, color: '#f59e0b', label: '' },
    { id: 'r9', x: 160, y: 260, r: 3, color: '#6366f1', label: '' },
    { id: 'r10', x: 230, y: 260, r: 3, color: '#6366f1', label: '' },
  ]

  const edges = [
    ['root', 'ai'], ['root', 'fitness'], ['root', 'business'], ['root', 'edu'], ['root', 'creative'],
    ['ai', 'coding'], ['coding', 'r1'], ['coding', 'r2'], ['ai', 'r3'], ['ai', 'r4'],
    ['fitness', 'r5'], ['fitness', 'r6'], ['business', 'r7'], ['business', 'r8'],
    ['edu', 'r9'], ['edu', 'r10'], ['root', 'creative'],
  ]

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[3/2]">
      <div className="absolute inset-0 bg-indigo-500/5 rounded-3xl blur-2xl" />
      <svg viewBox="0 0 400 280" className="w-full h-full relative z-10">
        {edges.map(([a, b], i) => (
          <line key={i} x1={nodeMap[a].x} y1={nodeMap[a].y} x2={nodeMap[b].x} y2={nodeMap[b].y} stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
        ))}
        {nodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={n.r > 6 ? 0.85 : 0.5} />
            {n.label && (
              <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fill="#a1a1aa" fontSize="8" fontFamily="system-ui">
                {n.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <motion.div className="absolute top-8 right-12 w-2 h-2 rounded-full bg-purple-400" animate={{ y: [0, -8, 0], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute bottom-12 left-16 w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ y: [0, 6, 0], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />
    </div>
  )
}

export function Login({ onLogin }: { onLogin: () => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const handleFeatureHover = useCallback((i: number | null) => setHovered(i), [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      <CursorGlow />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain size={16} />
            </div>
            <span className="font-bold text-sm">Reel Brain</span>
          </div>
          <button onClick={onLogin} className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors">
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20 px-4">
        {/* Subtle background gradient - no heavy blur on mobile */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[15%] left-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-500/[0.04] rounded-full blur-[80px] sm:blur-[120px]" />
          <div className="absolute bottom-[10%] right-[10%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-purple-500/[0.04] rounded-full blur-[80px] sm:blur-[120px]" />
        </div>

        {/* Floating badges - desktop only */}
        <motion.div className="absolute top-32 left-[8%] hidden lg:block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <div className="px-3 py-1.5 bg-zinc-900/90 border border-white/10 rounded-full text-[11px] text-zinc-400 backdrop-blur-sm shadow-xl">3D Neural Graph</div>
        </motion.div>
        <motion.div className="absolute top-44 right-[6%] hidden lg:block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <div className="px-3 py-1.5 bg-zinc-900/90 border border-white/10 rounded-full text-[11px] text-zinc-400 backdrop-blur-sm shadow-xl">AI-Powered</div>
        </motion.div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 mb-6">
                  <Sparkles size={12} />
                  AI-powered knowledge system
                </div>
              </motion.div>

              <motion.h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
                Your brain for
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Instagram Reels
                </span>
              </motion.h1>

              <motion.p className="text-base sm:text-lg text-zinc-400 max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                Paste a URL. AI transcribes, summarizes, tags, and builds a 3D knowledge graph.
                Search, chat, and never lose a great idea again.
              </motion.p>

              <motion.div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                <button onClick={onLogin} className="group px-7 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-all shadow-lg shadow-white/10 flex items-center gap-2">
                  Get Started Free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a href="https://github.com/mevikrampawar/Insta-Reel-Brain" target="_blank" rel="noopener noreferrer" className="px-7 py-3 bg-white/5 border border-white/10 rounded-xl font-medium text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-2">
                  <Code size={16} />
                  View Source
                </a>
              </motion.div>
            </div>

            <motion.div className="relative" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
              <GraphShowcase />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">How it works</h2>
            <p className="text-zinc-400">Three steps. Zero setup.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Paste a URL', desc: 'Share any Instagram Reel link. Add multiple at once — they process in parallel.', icon: Globe, color: 'from-blue-500 to-cyan-500' },
              { step: '02', title: 'AI analyzes', desc: 'Groq transcribes, summarizes, extracts key takeaways, tags, and builds your knowledge graph.', icon: Zap, color: 'from-purple-500 to-pink-500' },
              { step: '03', title: 'Search & chat', desc: 'Ask questions in natural language. TF-IDF search finds what you need instantly.', icon: MessageSquare, color: 'from-amber-500 to-orange-500' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="relative p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <item.icon size={18} />
                </div>
                <div className="text-xs text-zinc-600 font-mono mb-2">Step {item.step}</div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything you need</h2>
            <p className="text-zinc-400">One app to capture, understand, and rediscover.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Search, title: 'Semantic Search', desc: 'TF-IDF search runs entirely in your browser. No API calls, instant results.' },
              { icon: Network, title: '3D Knowledge Graph', desc: 'Interactive neural diagram. AI-generated category hierarchy, radial layout.' },
              { icon: MessageSquare, title: 'Chat with Library', desc: 'Ask questions about your saved reels. Get answers with citations.' },
              { icon: FolderOpen, title: 'Smart Collections', desc: 'Auto-organized by AI into categories. Manual groups too.' },
              { icon: Cpu, title: 'Deep AI Analysis', desc: 'Summaries, key takeaways, entities, concepts, quality scores.' },
              { icon: Shield, title: '100% Private', desc: 'Your data stays in your browser and your own Firebase. No server.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className={`p-5 rounded-xl border transition-all duration-300 cursor-default ${
                  hovered === i ? 'border-indigo-500/30 bg-indigo-500/5 sm:scale-[1.02]' : 'border-white/5 hover:border-white/10'
                }`}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onMouseEnter={() => handleFeatureHover(i)}
                onMouseLeave={() => handleFeatureHover(null)}
              >
                <item.icon size={20} className={`mb-3 transition-colors ${hovered === i ? 'text-indigo-300' : 'text-indigo-400'}`} />
                <h3 className="font-medium text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Neural Graph showcase section */}
      <section className="py-20 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-400 mb-4">
                <Eye size={12} />
                Interactive 3D Visualization
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                See your knowledge
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">come alive</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Your reels organize into a 3D neural diagram. Categories branch from a central &quot;Reel Brain&quot; node.
                AI determines the hierarchy. Zoom, orbit, drag — explore your knowledge visually.
              </p>
              <ul className="space-y-3 text-sm text-zinc-400">
                {['AI-generated category hierarchy', '3D text labels on every node', 'Color-coded by major topic', 'Click any node to view the reel'].map((item, i) => (
                  <motion.li
                    key={item}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-zinc-800 rounded-md px-3 py-1 text-[10px] text-zinc-500 text-center">
                      mevikrampawar.github.io/Insta-Reel-Brain/#graph
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <GraphShowcase />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20 px-4 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">No server. No backend.</h2>
            <p className="text-zinc-400">Runs entirely in your browser on GitHub Pages.</p>
          </motion.div>

          <motion.div
            className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 font-mono text-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-zinc-400">
              <span className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">Browser</span>
              <span className="text-zinc-700">→</span>
              <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">Apify</span>
              <span className="text-zinc-700">→</span>
              <span className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">Groq AI</span>
              <span className="text-zinc-700">→</span>
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">Firestore</span>
              <span className="text-zinc-700">→</span>
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">TF-IDF</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cost */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">$0 to start</h2>
            <p className="text-zinc-400 mb-10">All services have generous free tiers.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Apify', detail: '$5 free credit', sub: '~3,300 reels' },
              { name: 'Groq', detail: '30 req/min free', sub: 'No credit card' },
              { name: 'Firebase', detail: 'Spark plan', sub: '1 GB storage' },
              { name: 'GitHub Pages', detail: 'Free forever', sub: 'Public repos' },
            ].map((item, i) => (
              <motion.div
                key={item.name}
                className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-colors"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="font-medium text-sm mb-1">{item.name}</div>
                <div className="text-xs text-emerald-400 font-medium">{item.detail}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{item.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start building your
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">reel knowledge base</span>
          </h2>
          <p className="text-zinc-400 mb-8">
            Free. Open source. No credit card.
          </p>
          <button
            onClick={onLogin}
            className="group px-10 py-4 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-all shadow-lg shadow-white/10 flex items-center gap-2 mx-auto text-lg"
          >
            Sign in with Google
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Brain size={10} />
            </div>
            <span>Insta Reel Brain</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/mevikrampawar/Insta-Reel-Brain" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
            <span>100% open source</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
