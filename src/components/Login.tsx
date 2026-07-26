import { motion } from 'motion/react'
import { Brain, Search, Network, MessageSquare, Sparkles, FolderOpen, ArrowRight, Zap, Shield, Globe, Code } from 'lucide-react'

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain size={16} />
            </div>
            <span className="font-bold text-sm">Reel Brain</span>
          </div>
          <button
            onClick={onLogin}
            className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 mb-6">
              <Sparkles size={12} />
              AI-powered knowledge system
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Your brain for
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Instagram Reels
            </span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Paste a URL. AI handles everything — scraping, transcription, analysis, tagging, and semantic search.
            Never lose a great idea from a reel again.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={onLogin}
              className="group px-8 py-3.5 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-all shadow-lg shadow-white/10 flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <a
              href="https://github.com/mevikrampawar/Insta-Reel-Brain"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl font-medium text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <Code size={16} />
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">How it works</h2>
            <p className="text-zinc-400">Three steps. Zero setup.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Paste a URL',
                desc: 'Share any Instagram Reel link. Add multiple at once — they process in parallel.',
                icon: Globe,
                color: 'from-blue-500 to-cyan-500',
              },
              {
                step: '02',
                title: 'AI analyzes',
                desc: 'Groq transcribes, summarizes, extracts key takeaways, tags, and builds your knowledge graph.',
                icon: Zap,
                color: 'from-purple-500 to-pink-500',
              },
              {
                step: '03',
                title: 'Search & chat',
                desc: 'Ask questions in natural language. TF-IDF search finds what you need instantly.',
                icon: MessageSquare,
                color: 'from-amber-500 to-orange-500',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="relative p-6 bg-white/[0.02] border border-white/5 rounded-2xl"
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
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything you need</h2>
            <p className="text-zinc-400">One app to capture, understand, and rediscover.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Search, title: 'Semantic Search', desc: 'TF-IDF search runs entirely in your browser. No API calls, instant results.' },
              { icon: Network, title: '3D Knowledge Graph', desc: 'Visualize connections between reels. Category hierarchies powered by AI.' },
              { icon: MessageSquare, title: 'Chat with Library', desc: 'Ask questions about your saved reels. Get answers with citations.' },
              { icon: FolderOpen, title: 'Smart Collections', desc: 'Auto-organized by AI into categories. Manual groups too.' },
              { icon: Sparkles, title: 'Deep AI Analysis', desc: 'Summaries, key takeaways, entities, concepts, quality scores.' },
              { icon: Shield, title: '100% Private', desc: 'Your data stays in your browser and your own Firebase. No server.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <item.icon size={20} className="text-indigo-400 mb-3 group-hover:text-indigo-300 transition-colors" />
                <h3 className="font-medium text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
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
      <section className="py-20 px-4 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
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
                className="p-4 bg-white/[0.02] border border-white/5 rounded-xl"
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
