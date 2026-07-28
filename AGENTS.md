# AGENTS.md — AI Development Workflow Reference

## Project Overview

**Insta Reel Brain** — AI-powered personal knowledge system for Instagram Reels. 100% client-side, no server. Deploys to GitHub Pages.

Paste a URL → Apify scrapes → Groq analyzes → Firestore stores → TF-IDF searches (all in-browser).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (localhost:5173) |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run lint` | Run oxlint |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run preview` | Build + Wrangler dev (Cloudflare Worker) |
| `npm run deploy` | Build + Wrangler deploy (Cloudflare Worker) |

**Always run `npm run typecheck` and `npm run lint` before committing.**

## Tech Stack

- React 19, TypeScript (~6.0), Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Radix UI primitives (dialog, dropdown, tabs, toast, tooltip, etc.)
- Firebase Auth (Google Sign-In) + Cloud Firestore
- Groq API (llama-3.3-70b-versatile) for AI analysis
- Apify API for Instagram scraping
- react-force-graph-3d + Three.js for 3D knowledge graph
- oxlint for linting

## Project Structure

```
src/
  App.tsx              # Main app: auth gate, tab routing, batch processing
  main.tsx             # React entry point
  firebase-config.ts   # Firebase client SDK init
  components/          # UI components (Layout, Library, Chat, NeuralGraph, etc.)
  hooks/               # Custom hooks (useAuth, useReels, useCollections, etc.)
  services/            # API integrations (apify.ts, groq.ts, ingestion.ts, firebase.ts, userData.ts)
  utils/               # Helpers (search/tfidf, constants, export, format, retry, rateLimit)
  types/               # TypeScript interfaces (types/index.ts)
  lib/                 # Utilities (tour)
public/
  manifest.json        # PWA manifest with share target
  sw.js                # Service worker (cache-first assets, network-first navigation)
worker/
  index.js             # Cloudflare Worker — iOS Shortcut relay (Firebase REST API, no firebase-admin)
scripts/
  generate-icons.cjs   # PWA icon generation
```

## Code Conventions

- **Styling:** Tailwind CSS utility classes. No CSS modules or styled-components.
- **Components:** Functional components with hooks. Exported as named exports.
- **State:** React hooks (useState, useCallback, custom hooks). No Redux/Zustand.
- **API keys:** Stored per-user in Firestore (via ApiKeyContext). Optional master keys via `.env` for trial mode.
- **Path alias:** `@/` maps to `src/` (configured in vite.config.ts).
- **Linting:** oxlint (`.oxlintrc.json`). Not ESLint.
- **No comments** in code unless explicitly requested.

## Architecture Notes

- **No backend/proxy.** All API calls (Apify, Groq, Firebase) are made directly from the browser.
- **Firestore rules** (`firestore.rules`): Users can only read/write their own `users/{userId}/` subcollection.
- **Cloudflare Worker** (`worker/index.js`): Optional relay for iOS Shortcuts. Uses Firebase REST API with manual JWT signing (no `firebase-admin` SDK).
- **PWA:** Installable, has share target (Android/Chrome), clipboard detection (iOS), offline caching for static assets.
- **Base path:** `/Insta-Reel-Brain/` (GitHub Pages). Configured in `vite.config.ts` and `public/manifest.json`.

## Key Data Flow

1. User pastes Instagram reel URL
2. `services/apify.ts` → Apify API scrapes reel data (caption, hashtags, transcript, creator)
3. `services/ingestion.ts` → Orchestrates: scrape → analyze → classify → store
4. `services/groq.ts` → Groq API generates summary, takeaways, tags, entities, category hierarchy
5. `services/firebase.ts` → Stores reel document in Firestore under `users/{uid}/reels/{reelId}`
6. `utils/search.ts` / `utils/tfidf.ts` → In-browser TF-IDF search (no API calls)

## Testing Changes

1. `npm run typecheck` — must pass with no errors
2. `npm run lint` — must pass with no errors
3. `npm run build` — must produce `dist/` successfully
4. Manual test: `npm run dev` → open localhost:5173 → sign in → test feature

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically (`.github/workflows/deploy.yml`).

Cloudflare Worker is deployed separately via `npm run deploy` (Wrangler).
