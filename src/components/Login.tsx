import { Brain } from 'lucide-react'

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain size={36} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Insta Reel Brain</h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            AI-powered knowledge system for your saved Instagram Reels.
            Search, organize, and rediscover everything.
          </p>
        </div>
        <button
          onClick={onLogin}
          className="px-8 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
