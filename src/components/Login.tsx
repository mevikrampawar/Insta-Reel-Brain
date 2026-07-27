import { Brain, Sparkles, Search, Network } from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'AI Analysis',
    desc: 'Automatic transcripts, summaries, and key takeaways from every Reel.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    desc: 'Find any idea instantly with instant in-browser TF-IDF search.',
  },
  {
    icon: Network,
    title: 'Knowledge Graph',
    desc: 'Visualize how topics connect in an interactive neural diagram.',
  },
]

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden bg-background text-white">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="login-gradient-orb login-gradient-orb-1" />
        <div className="login-gradient-orb login-gradient-orb-2" />
        <div className="login-gradient-orb login-gradient-orb-3" />
      </div>

      <style>{`
        .login-gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          will-change: transform;
        }
        .login-gradient-orb-1 {
          width: 600px; height: 600px;
          top: -20%; left: -10%;
          background: rgba(99, 102, 241, 0.08);
          animation: floatOrb1 12s ease-in-out infinite alternate;
        }
        .login-gradient-orb-2 {
          width: 500px; height: 500px;
          bottom: -10%; right: -5%;
          background: rgba(168, 85, 247, 0.06);
          animation: floatOrb2 14s ease-in-out infinite alternate;
        }
        .login-gradient-orb-3 {
          width: 400px; height: 400px;
          top: 40%; left: 50%;
          transform: translateX(-50%);
          background: rgba(236, 72, 153, 0.04);
          animation: floatOrb3 16s ease-in-out infinite alternate;
        }
        @keyframes floatOrb1 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(80px, 60px) scale(1.1); }
        }
        @keyframes floatOrb2 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-60px, -40px) scale(1.05); }
        }
        @keyframes floatOrb3 {
          0%   { transform: translateX(-50%) scale(1); }
          100% { transform: translateX(-40%) translateY(-30px) scale(1.08); }
        }
      `}</style>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
        {/* Logo */}
        <div className="mb-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
          <Brain size={28} />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-[1.1]">
          Your brain for
          <br />
          <span className="gradient-text">Instagram Reels</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-md mb-10 leading-relaxed">
          Paste a URL. AI transcribes, summarizes, and builds a knowledge graph.
          Search, chat, and never lose a great idea.
        </p>

        {/* CTA */}
        <button
          onClick={onLogin}
          className="group flex items-center gap-3 px-8 py-3.5 bg-white text-black rounded-xl font-semibold text-base hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-lg shadow-white/10"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Get Started Free
        </button>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 max-w-3xl w-full mx-auto">
        {features.map((f) => (
          <div
            key={f.title}
            className="glass-card p-5 text-center"
          >
            <f.icon size={22} className="text-primary mx-auto mb-3" />
            <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-16 mb-6 text-xs text-zinc-600">
        Built with AI
      </p>
    </div>
  )
}
