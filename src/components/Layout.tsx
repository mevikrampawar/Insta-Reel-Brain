import { useState, type ReactNode } from 'react'
import { Brain, LogOut, Plus, FolderOpen, MessageSquare, Settings as SettingsIcon, Network, Activity, Menu, X } from 'lucide-react'

export interface NavState {
  tab: string
  highlightReelId?: string
}

interface Props {
  children: ReactNode
  nav: NavState
  onNavChange: (nav: NavState) => void
  onLogout: () => void
  userPhoto?: string
}

const primaryTabs = [
  { id: 'library', label: 'Library', icon: FolderOpen },
  { id: 'ingest', label: 'Add', icon: Plus },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'graph', label: 'Graph', icon: Network },
]

const secondaryTabs = [
  { id: 'collections', label: 'Collections', icon: Brain },
  { id: 'datasources', label: 'Data Sources', icon: Activity },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function Layout({ children, nav, onNavChange, onLogout, userPhoto }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-zinc-800 flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Brain size={16} />
            </div>
            <span className="font-bold text-sm">Reel Brain</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[...primaryTabs, ...secondaryTabs].map(t => (
            <button
              key={t.id}
              onClick={() => onNavChange({ tab: t.id })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                nav.tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2">
            {userPhoto && <img src={userPhoto} className="w-6 h-6 rounded-full" alt="" />}
            <button onClick={onLogout} className="text-zinc-400 hover:text-white transition-colors ml-auto">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain size={14} />
          </div>
          <span className="font-bold text-sm">Reel Brain</span>
        </div>
        <div className="flex items-center gap-2">
          {userPhoto && <img src={userPhoto} className="w-7 h-7 rounded-full" alt="" />}
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2.5 text-zinc-400 hover:text-white -mr-2.5">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-over menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="relative ml-auto w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-medium text-sm">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {secondaryTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onNavChange({ tab: t.id }); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${
                    nav.tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <t.icon size={18} />
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-zinc-800">
              <button onClick={() => { onLogout(); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-zinc-400 hover:text-red-400 transition-colors">
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav — 44px+ touch targets */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-1.5 px-1 shrink-0 z-40 safe-area-bottom">
        {primaryTabs.map(t => (
          <button
            key={t.id}
            onClick={() => onNavChange({ tab: t.id })}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-2 py-1.5 rounded-xl transition-colors ${
              nav.tab === t.id ? 'text-indigo-400' : 'text-zinc-500'
            }`}
          >
            <t.icon size={20} strokeWidth={nav.tab === t.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium leading-none">{t.label}</span>
          </button>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-2 py-1.5 rounded-xl text-zinc-500"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>
    </div>
  )
}
