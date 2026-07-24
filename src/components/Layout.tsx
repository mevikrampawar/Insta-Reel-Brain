import type { ReactNode } from 'react'
import { Brain, LogOut, Plus, FolderOpen } from 'lucide-react'

interface Props {
  children: ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
  onLogout: () => void
  userPhoto?: string
}

const tabs = [
  { id: 'library', label: 'Library', icon: FolderOpen },
  { id: 'graph', label: 'Knowledge Graph', icon: Brain },
]

export function Layout({ children, activeTab, onTabChange, onLogout, userPhoto }: Props) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Brain size={16} />
            </div>
            <span className="font-bold text-sm">Reel Brain</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-zinc-800 space-y-1">
          <button
            onClick={() => onTabChange('ingest')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Plus size={16} />
            Add Reel
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            {userPhoto && <img src={userPhoto} className="w-6 h-6 rounded-full" alt="" />}
            <button onClick={onLogout} className="text-zinc-400 hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
