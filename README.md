# Insta Reel Brain

AI-powered personal knowledge system for Instagram Reels. Paste a URL — AI handles everything: scraping, transcription, analysis, tagging, and semantic search.

**Live site:** [mevikrampawar.github.io/Insta-Reel-Brain](https://mevikrampawar.github.io/Insta-Reel-Brain/)

## Features

- **Paste & forget** — paste a URL, AI handles scraping, transcription, analysis, and tagging
- **Non-blocking ingestion** — add multiple URLs while previous ones process in parallel
- **Semantic search** — TF-IDF with keyword fallback, runs entirely in-browser, no API calls
- **3D Knowledge Graph** — hierarchical category tree with Reel Brain root node, radial layout, 3D text labels
- **Chat with Library** — ask questions in natural language, get answers citing your saved reels
- **Smart Collections** — AI auto-organizes reels into categories + manual groups
- **Deep AI Analysis** — summaries, key takeaways, entities, concepts, quality scores
- **Notes** — per-reel annotations
- **Data Sources** — see where each field came from and cost breakdown
- **Export** — download your library as CSV or JSON
- **PWA** — installable on mobile and desktop, works offline for cached data
- **Auto-ingest** — iOS Shortcuts and Android share sheet integration

## Architecture

100% client-side. No server, no proxy, no backend. Runs entirely in the browser on GitHub Pages.

```
Browser → Apify API (scrape) → Groq API (analyze) → Firestore (store) → TF-IDF search
```

- **Apify** — scrapes reel data (captions, hashtags, creator, transcript) directly from the browser
- **Groq** — powers AI analysis, hierarchy classification, semantic search, and chat
- **Firebase** — Google Sign-In + Firestore for per-user data storage
- **TF-IDF** — in-browser text similarity search. No embeddings API needed

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Cloud Firestore |
| AI (LLM) | Groq API (llama-3.3-70b-versatile) |
| Scraping | Apify API (instagram-reel-scraper actor) |
| Search | TF-IDF (in-browser) |
| 3D Graph | react-force-graph-3d, Three.js |
| Deploy | GitHub Pages (via GitHub Actions) |

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, sign in with Google, then add your API keys in **Settings**:

1. **Apify API Key** — [console.apify.com](https://console.apify.com) → Sign up → Settings → API Token (free)
2. **Groq API Key** — [console.groq.com](https://console.groq.com) → Sign in → API Keys → Create (free)

API keys are stored per-user in Firestore. No `.env` files needed.

## Auto-Ingest URLs

You don't have to manually paste URLs. Set up automatic ingestion from your phone.

### iOS Shortcut (iPhone) — Recommended

The best way to add reels from your iPhone. Set up once, use forever.

**One-tap install:** Open the app → tap **Add** → expand **"Quick ways to add reels"** → tap **"Install Shortcut"**. The shortcut installs automatically.

**Manual setup:** If the direct install doesn't work, go to Add → Quick ways → iOS Shortcut → follow the instructions.

**To use it:** From Instagram → tap Share → scroll down → tap "Add to Reel Brain" → the reel auto-opens in your app and starts processing. Works from any Instagram screen — feed, reels, stories, or profiles.

### Android / Desktop (PWA Share Target)

1. Open [mevikrampawar.github.io/Insta-Reel-Brain](https://mevikrampawar.github.io/Insta-Reel-Brain/) in Chrome
2. Install as PWA: Chrome menu → **Install app** (or bell icon in address bar)
3. From Instagram app: tap **Share** → **Reel Brain** appears in the share sheet
4. From desktop: right-click a reel → **Share** → pick Reel Brain

### Deep Links

The app supports deep links via URL parameter:

```
https://mevikrampawar.github.io/Insta-Reel-Brain/?url=https://www.instagram.com/reel/ABC123/
```

When opened, the app auto-navigates to the ingest tab and adds the URL to the queue. If you're not logged in, the URL is saved and processed after you sign in.

### Clipboard Detection (iOS & Desktop)

When you open the app, it automatically checks your clipboard for Instagram URLs. If one is found, you'll see a banner with an "Add it" button — just tap to ingest. This works on iOS 16+ (shows a paste permission banner) and all desktop browsers.

## How It Works

1. **Add Reel** — paste a URL, use an iOS Shortcut, or share via PWA
2. **Apify scrapes** — captions, hashtags, creator handle, thumbnail, transcript
3. **Groq analyzes** — generates summary, key takeaways, suggested tags, entities, and concepts
4. **Groq classifies** — assigns a hierarchical category path (e.g., AI & Technology → Coding → React)
5. **Search** — TF-IDF semantic search runs entirely in-browser
6. **Chat** — ask questions about your reel library, Groq answers using relevant context

## 3D Knowledge Graph

The graph visualizes your reel library as a hierarchical tree:

- **Root node** — "Reel Brain" at the center (glowing icosahedron)
- **Category nodes** — major categories (AI & Technology, Fitness, etc.) branch out with 3D text labels
- **Sub-category nodes** — AI-generated sub-categories (Coding, Weight Training, etc.)
- **Reel nodes** — individual reels connected to their leaf category

Features:
- Radial layout with strong force separation for readability
- Category nodes sized by reel count
- Click any node to navigate to that reel
- **Recalibrate** button resets camera to default view after zooming/panning

## Project Structure

```
src/
  components/      # 13 UI components
  hooks/           # 6 custom hooks (auth, reels, collections, notes, scrape queue, API keys)
  services/        # 4 service modules (apify, groq, ingestion, firebase)
  utils/           # 8 utilities (constants, export, format, quality, rateLimit, retry, search, tfidf)
  types/           # TypeScript interfaces
public/
  manifest.json    # PWA manifest with share target
  sw.js            # Service worker for PWA
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run oxlint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run preview` | Preview production build |

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically.

```bash
git push origin main
```

## Cost

$0 to start. All services have free tiers:

| Service | Free Tier |
|---------|-----------|
| **Apify** | $5 credit on signup (~3,300 reels) |
| **Groq** | 30 req/min, no credit card |
| **Firebase** | Spark plan (1 GB storage, 10 GB bandwidth) |
| **GitHub Pages** | Free for public repos |
