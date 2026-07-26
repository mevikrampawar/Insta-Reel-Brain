import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Brain, LogOut, Plus, FolderOpen, MessageSquare, Settings as SettingsIcon, Network, Activity, Menu, X, LayoutDashboard } from 'lucide-react'

export interface NavState {
  tab: string
  highlightReelId?: string
  libraryFilters?: {
    categories?: string[]
    creator?: string
  }
}

interface Props {
  children: ReactNode
  nav: NavState
  onNavChange: (nav: NavState) => void
  onLogout: () => void
  userPhoto?: string
}

const primaryTabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
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
      <aside className="hidden md:flex w-56 flex-col shrink-0 glass-strong border-r border-white/5">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain size={16} />
            </div>
            <span className="font-bold text-sm">Reel Brain</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {[...primaryTabs, ...secondaryTabs].map(t => (
            <button
              key={t.id}
              onClick={() => onNavChange({ tab: t.id })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                nav.tab === t.id
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2">
            {userPhoto && (
              <img src={userPhoto} className="w-6 h-6 rounded-full ring-2 ring-white/10" alt="Profile" />
            )}
            <button onClick={onLogout} className="text-zinc-400 hover:text-white transition-colors ml-auto" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0 glass-strong">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Brain size={14} />
          </div>
          <span className="font-bold text-sm">Reel Brain</span>
        </div>
        <div className="flex items-center gap-2">
          {userPhoto && <img src={userPhoto} className="w-7 h-7 rounded-full ring-2 ring-white/10" alt="Profile" />}
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2.5 text-zinc-400 hover:text-white -mr-2.5" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-over menu */}
      <AnimatePresence>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="relative ml-auto w-72 glass-strong flex flex-col h-full"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="font-medium text-sm">Menu</span>
                <button onClick={() => setMenuOpen(false)} className="p-2 text-zinc-500 hover:text-white" aria-label="Close menu"><X size={18} /></button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {secondaryTabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { onNavChange({ tab: t.id }); setMenuOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all duration-200 ${
                      nav.tab === t.id
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <t.icon size={18} />
                    {t.label}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t border-white/5">
                <button onClick={() => { onLogout(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-zinc-400 hover:text-red-400 transition-colors">
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav — 48px touch targets */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-white/5 flex justify-around py-1.5 px-1 shrink-0 z-40 safe-area-bottom">
        {primaryTabs.map(t => (
          <button
            key={t.id}
            onClick={() => onNavChange({ tab: t.id })}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-2 py-1.5 rounded-xl transition-all duration-200 ${
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
