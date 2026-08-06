import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain,
  LogOut,
  Plus,
  FolderOpen,
  MessageSquare,
  Settings as SettingsIcon,
  Network,
  Activity,
  Menu,
  X,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  needsApiSetup?: boolean
}

const primaryTabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, tour: 'nav-dashboard' },
  { id: 'library', label: 'Library', icon: FolderOpen, tour: 'nav-library' },
  { id: 'ingest', label: 'Add', icon: Plus, tour: 'nav-ingest' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, tour: 'nav-chat' },
  { id: 'graph', label: 'Neural', icon: Network, tour: 'nav-graph' },
]

const secondaryTabs = [
  { id: 'collections', label: 'Collections', icon: Brain, tour: 'nav-collections' },
  { id: 'datasources', label: 'Data Sources', icon: Activity, tour: 'nav-datasources' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, tour: 'nav-settings' },
]

function AvatarCircle({ photo, email }: { photo?: string; email?: string }) {
  const initial = email?.[0]?.toUpperCase() ?? '?'
  if (photo) {
    return <img src={photo} className="w-8 h-8 rounded-full ring-2 ring-white/10" alt="Profile" />
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
      {initial}
    </div>
  )
}

function SidebarNav({
  nav,
  onNavChange,
  onLogout,
  userPhoto,
}: {
  nav: NavState
  onNavChange: (nav: NavState) => void
  onLogout: () => void
  userPhoto?: string
}) {
  return (
    <>
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain size={16} />
          </div>
          <span className="font-bold text-sm">Reel Brain</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Main</span>
        </div>
        {primaryTabs.map((t) => {
          const active = nav.tab === t.id
          return (
            <button
              key={t.id}
              data-tour={t.tour}
              onClick={() => onNavChange({ tab: t.id })}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                active
                  ? 'bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]',
              )}
            >
              <t.icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {t.label}
            </button>
          )
        })}

        <div className="px-2 pt-4 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">More</span>
        </div>
        {secondaryTabs.map((t) => {
          const active = nav.tab === t.id
          return (
            <button
              key={t.id}
              data-tour={t.tour}
              onClick={() => onNavChange({ tab: t.id })}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                active
                  ? 'bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]',
              )}
            >
              <t.icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {t.label}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2">
          <AvatarCircle photo={userPhoto} />
          <span className="text-xs text-zinc-500 truncate flex-1">Account</span>
          <button
            onClick={onLogout}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

export function Layout({ children, nav, onNavChange, onLogout, userPhoto, needsApiSetup }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const showBanner = needsApiSetup && nav.tab === 'dashboard' && !bannerDismissed

  const handleNav = useCallback(
    (id: string) => {
      onNavChange({ tab: id })
      setMenuOpen(false)
    },
    [onNavChange],
  )

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col shrink-0 glass-strong border-r border-white/5">
        <SidebarNav
          nav={nav}
          onNavChange={onNavChange}
          onLogout={onLogout}
          userPhoto={userPhoto}
        />
      </aside>

      {/* ── Mobile header ──────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shrink-0 glass-strong border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md shadow-primary/20">
            <Brain size={14} />
          </div>
          <span className="font-bold text-sm">Reel Brain</span>
        </div>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-2.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* ── Mobile slide-over menu ─────────────────────── */}
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
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="font-semibold text-sm">Menu</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {secondaryTabs.map((t) => {
                  const active = nav.tab === t.id
                  return (
                    <button
                      key={t.id}
                      data-tour={t.tour}
                      onClick={() => handleNav(t.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all duration-200',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]',
                      )}
                    >
                      <t.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                      {t.label}
                    </button>
                  )
                })}
              </nav>
              <div className="p-3 border-t border-white/5">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <AvatarCircle photo={userPhoto} />
                  <span className="text-xs text-zinc-500 truncate flex-1">Account</span>
                </div>
                <button
                  onClick={() => {
                    onLogout()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-[max(4.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] md:pb-0">
        {/* Dismissible API setup banner */}
        {showBanner && (
          <div className="mx-3 mt-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-sm">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-amber-300/90 flex-1">
              <span className="font-medium">5 free reels</span> included. Add your own API keys in Settings for unlimited use.
            </p>
            <button
              onClick={() => onNavChange({ tab: 'settings' })}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-xs font-medium text-amber-300 shrink-0 transition-colors"
            >
              Settings
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 text-amber-400/50 hover:text-amber-400 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {children}
      </main>

      {/* ── Mobile bottom nav ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-white/5 flex justify-around items-center px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shrink-0 z-40 safe-bottom">
        {primaryTabs.map((t) => {
          const active = nav.tab === t.id
          return (
            <button
              key={t.id}
              data-tour={t.tour}
              onClick={() => onNavChange({ tab: t.id })}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl transition-colors duration-200',
                active ? 'text-primary' : 'text-zinc-500',
              )}
            >
              <t.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{t.label}</span>
              {active && (
                <motion.span
                  layoutId="bottom-nav-indicator"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl text-zinc-500 hover:text-white transition-colors"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>
    </div>
  )
}


