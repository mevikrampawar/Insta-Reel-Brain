import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { installErrorReporter } from './utils/errorReporter'
import './index.css'
import App from './App'

installErrorReporter()

// Register service worker for PWA + share target
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Insta-Reel-Brain/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
