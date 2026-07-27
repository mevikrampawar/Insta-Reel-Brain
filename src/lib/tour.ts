import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'reelbrain-tour-completed'

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourCompleted() {
  try {
    localStorage.setItem(TOUR_KEY, '1')
  } catch {
    // ignore
  }
}

export function startTour() {
  const steps: DriveStep[] = [
    {
      element: '[data-tour="nav-dashboard"]',
      popover: {
        title: 'Dashboard',
        description: 'Your knowledge overview at a glance — trending reels, top tags, and activity.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-ingest"]',
      popover: {
        title: 'Add Reels',
        description: 'Paste any Instagram reel URL and AI will analyze it automatically.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-library"]',
      popover: {
        title: 'Library',
        description: 'Browse, search, and filter all your analyzed reels.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-chat"]',
      popover: {
        title: 'AI Chat',
        description: 'Ask questions about your reels — get insights, summaries, and recommendations.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-graph"]',
      popover: {
        title: 'Knowledge Graph',
        description: 'Explore connections between your reels in an interactive 3D graph.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-settings"]',
      popover: {
        title: 'Settings',
        description: 'Add your own API keys for unlimited use. Free trial includes 5 reels.',
        side: 'right',
      },
    },
  ]

  // Filter out steps where the element doesn't exist
  const validSteps = steps.filter(step => {
    if (!step.element) return true
    const selector = step.element as string
    return document.querySelector(selector) !== null
  })

  if (validSteps.length === 0) return

  const driverObj = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    stagePadding: 8,
    stageRadius: 12,
    popoverClass: 'reelbrain-tour-popover',
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it!',
    onDeselected: () => {},
    onDestroyStarted: () => {
      markTourCompleted()
      driverObj.destroy()
    },
    steps: validSteps,
  })

  driverObj.drive()
}
