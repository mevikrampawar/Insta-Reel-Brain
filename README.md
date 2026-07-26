# Insta Reel Brain

AI-powered personal knowledge system for Instagram Reels. Paste a URL — AI handles everything: scraping, transcription, analysis, tagging, and semantic search.

## Architecture

100% client-side. No server, no proxy, no backend. Runs entirely in the browser on GitHub Pages.

```
Browser → Apify API (scrape) → Groq API (analyze) → Firestore (store) → TF-IDF search
```

- **Apify** — scrapes reel data (captions, hashtags, creator, transcript) directly from the browser. $5 free credit (~3,300 reels).
- **Groq** — powers AI analysis, semantic search, and chat. Free tier (30 req/min).
- **Firebase** — Google Sign-In + Firestore for per-user data storage.
- **TF-IDF** — in-browser text similarity search. No embeddings API needed.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Cloud Firestore |
| AI (LLM) | Groq API (llama-3.3-70b-versatile) |
| Scraping | Apify API (instagram-reel-scraper actor) |
| Search | TF-IDF (in-browser, no API) |
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

## How It Works

1. **Add Reel** — paste an Instagram Reel URL
2. **Apify scrapes** — captions, hashtags, creator handle, thumbnail, transcript (direct browser → Apify, no proxy)
3. **Groq analyzes** — generates summary, key takeaways, suggested tags, and concepts
4. **Search** — TF-IDF semantic search runs entirely in-browser
5. **Chat** — ask questions about your reel library, Groq answers using relevant context

## Features

- **Non-blocking ingestion** — add multiple URLs while previous ones process
- **Semantic search** — TF-IDF with keyword fallback, no API calls
- **Knowledge Graph** — concept-concept relationships via co-occurrence
- **Chat with Library** — ask questions, get answers citing your reels
- **Collections** — organize reels into custom groups
- **Notes** — per-reel annotations
- **Data Sources** — see where each field came from and cost breakdown
- **Export** — download your library as CSV or JSON

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically.

```bash
git push origin main
```

Live site: `https://mevikrampawar.github.io/Insta-Reel-Brain/`

## Project Structure

```
src/
  components/     # 12 UI components
  hooks/          # 6 custom hooks (auth, reels, collections, notes, scrape queue, API keys)
  services/       # 4 service modules (apify, groq, ingestion, firebase)
  utils/          # 5 utilities (tfidf, search, rateLimit, retry, export)
  types/          # TypeScript interfaces
```

## Cost

$0. All services have free tiers:
- **Apify**: $5 free credit on signup (~3,300 reels at $1/1,000)
- **Groq**: 30 req/min free tier
- **Firebase**: Spark plan (free)
- **GitHub Pages**: Free for public repos
