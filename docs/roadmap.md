# Insta Reel Brain — Production & Growth Roadmap

> Living document. Last updated: 2026-08-06.
> Status legend: ⬜ backlog · 🚧 in progress · ✅ done

## North Star

Turn a single-platform "reel archive" into a **server-backed, cross-platform video knowledge base with retention and monetization** — while the user keeps full control of their data.

**Non-negotiables:**
1. Fix the live security hole first.
2. Never break existing BYOK users during migration (dual-mode: server-backed default, BYOK retained as an opt-in).
3. Every phase ends in a deployable, lint-clean, typecheck-passing state.

---

## Phase 0 — P0 Security (do first)

| # | Item | Where | Status |
|---|---|---|---|
| 0.1 | Validate `userId` (regex + length + constant path) to kill service-account path injection | `worker/index.js` | ✅ |
| 0.2 | Authenticate the relay: per-user shared secret required on every worker call + per-IP rate limit | `worker/index.js` | ✅ (shared secret via `RELAY_SECRET`; per-IP rate limit deferred to Phase 2a worker API) |
| 0.3 | Harden CORS (restricted origin) + sanitize error responses (stop leaking internals) | `worker/index.js` | ✅ |
| 0.4 | Strengthen Firestore rules: field-level validation, restrict writes to `pendingUrls`/`settings`, block bulk abuse | `firestore.rules` | ✅ (validated against Firestore emulator: 12/12 tests pass) |
| 0.5 | Real master-key limit enforcement: transactional counter + gate in the queue, not just the submit button | `ApiKeyContext.tsx`, `useScrapeQueue.ts` | ✅ (atomic reserve/release via `runTransaction`, refund on failure) |
| 0.6 | `clearAllUserData` clears `pendingUrls` + parent doc | `services/userData.ts` | ✅ (parent doc is never created by the app, so no cleanup needed) |

**DoD:** external security review of worker + rules passes; the relay cannot write outside the caller's own `pendingUrls`. — Committed as `a51917b` + `9b6dcda`.

Also done as part of Phase 0: knowledge graph reworked to a single 2D brain-like renderer, Three.js removed (bundle −45%, 2.9MB → 1.6MB) — `817d543`.

---

## Phase 1 — Client data-layer reliability + bug fixes

| # | Item | Status |
|---|---|---|
| 1.1 | Kill mutation refetch storms — optimistic local writes + single Firestore subscription | ✅ (`useReels`, `useCollections` rewritten: `onSnapshot` + rollback/`refresh`) |
| 1.2 | Fix N+1 notes query — per-reel cache, lazy-load on panel open | ✅ (new `NotesContext.tsx` store; `useNotes.ts` deleted) |
| 1.3 | Pagination ("load more") + Firestore persistent cache for offline | ✅ (`Library.tsx` page-size + load-more; `initializeFirestore` persistent cache) |
| 1.4 | Service worker: precache at install, versioned caches + prune | ✅ (`public/sw.js` — `-shell`/`-assets` versioned, S-W-R) |
| 1.5 | Correctness bugs + pipeline de-dupe | ✅ (stale-closure fix, gradient keys, `keepReels` no-op removal, unified `runApifyScrape`, dead code deleted) |
| 1.6 | CI gates + minimal error-tracking sink | ✅ (lint + typecheck in `deploy.yml`; `utils/errorReporter.ts` + Settings Diagnostics card) |

**DoD:** typecheck + lint (only pre-existing fast-refresh warnings) + production build pass.

---

## Neural Graph — Obsidian-style canvas

| # | Item | Status |
|---|---|---|
| G.1 | Organic interconnected network: reel, concept (weighted), entity, and creator nodes — no forced category tree | ✅ (`src/utils/brainNetwork.ts`) |
| G.2 | Cross-reel edges from TF-IDF topic similarity + concept co-occurrence links | ✅ (reuses `src/utils/tfidf.ts`) |
| G.3 | Obsidian-style interactions: drag to pan, scroll/pinch to zoom, tap reel → open, tap concept/entity/creator → focus + connected reels panel, double-tap → zoom to node, drag to pin | ✅ (`src/components/NeuralGraph.tsx`) |
| G.4 | Live search that filters the graph to matching reels + their neighbors | ✅ |
| G.5 | Mobile-first canvas: touch pan/zoom, safe-area bottom sheet panel, compact toolbar; tab renamed "Graph" → "Neural" | ✅ (`Layout.tsx`) |
| G.6 | **Curated neural engine** — only high-signal links: concepts by weight (≥0.3) or bridge (≥2 reels, top-3/reel), entities only when shared (≥2 reels), topic-similar links deduped against shared concepts (top-3/reel), concept bridges only when co-occurring ≥2 reels | ✅ (`brainNetwork.ts`) |
| G.7 | **Descriptive + interactive**: per-link reason tooltips ("Shares concept X", "Similar topics — 87%", "Created by @x"), link hover highlight, tap-any-node connection panel (concepts w/ weights, similar reels w/ %, creator, entities, co-occurs), reel tooltips with summary snippet | ✅ (`NeuralGraph.tsx`) |
| G.8 | **Mobile full-screen fix** — viewport-based measurement (graph fills remaining screen above the bottom nav), explicit pixel height instead of fragile `h-full` chain | ✅ (`NeuralGraph.tsx`) |
| G.9 | **Brain-like neural engine** — organic dense layout (weak charge, strong center pull, short concept synapses, long-range concept bridges), concept hubs (≥3 reels) glow brighter, tighter curation (top-2 concepts/reel, similar ≥30% + dedup, bridges only co-occurring ≥2) | ✅ (`brainNetwork.ts`) |
| G.10 | **Expressive visuals** — breathing neuron halos, pulsing selection ring, firing-synapse sweep (white glow sweeping the network, reheated for gentle drift), glow on hover | ✅ (`NeuralGraph.tsx`) |

**DoD:** typecheck + lint + production build pass. — Committed as `pending`.



## Phase 2 — Thin server layer (the unlock)

Grow the Cloudflare Worker into the backend. Dual-mode: new users default to server-backed; existing BYOK users keep working (toggle in Settings).

- **2a. Worker API foundation** — Firebase ID-token verification (JWKS), typed `/api/*` routes, server-side key vault (provider keys in Worker secrets/KV; per-user keys encrypted), entitlements/credits ledger in Firestore (transactional), per-user rate limits.

  **Done (this pass):**
  - ✅ Firebase ID-token verification — RS256 signature checked against Google's JWKS, `aud`/`iss`/`exp` validated, keys cached 1h with in-flight dedupe (`worker/auth.js`).
  - ✅ Typed routes: `POST /api/relay`, `GET /api/me`, `POST /api/usage/reserve`, `POST /api/usage/release`; relay accepts shared secret **or** ID token (identity from token, never the body) (`worker/index.js`).
  - ✅ Per-user (Bearer) + per-IP (relay) fixed-window rate limits via KV with in-memory fallback (`worker/ratelimit.js`, `RATE_LIMIT_KV` bound in `wrangler.jsonc`).
  - ✅ Server-side credits ledger — `masterKeyUsage` mutated via Firestore REST readWrite transactions (begin/read/commit/rollback with retry on abort); client `ApiKeyContext` now prefers the worker and falls back to the old client-side transaction when the worker is unconfigured (`worker/firestore.js`, `src/services/relay.ts`, `src/config/relay.ts`).
  - ⬜ **Remaining:** server-side key vault — provider keys in Worker secrets; **per-user keys encrypted** at rest + migration of existing plaintext BYOK keys (deferred; needs careful design to not break BYOK users).

- **2b. Server-side ingestion** — move Apify→Groq→Firestore into the worker with a real per-user queue (Durable Object): webhook completion, retries, dedup, abort-on-cancel.

  **Design.** A per-user Durable Object (`IngestQueue`, `INGEST_QUEUE` binding) is the job coordinator; Firestore stays the durable source of truth. The DO owns the state machine (`queued → apify_running → analyzing → complete | failed | cancelled`) and persists in-progress jobs in SQLite-backed DO storage. Completion is pushed via an **Apify webhook** that the worker forwards to the DO; a DO **alarm** backstop polls Apify if the webhook never arrives (≤3 retries, exponential backoff 30s/2m/10m). The server path runs on **provider keys** (worker secrets `APIFY_API_TOKEN`, `GROQ_API_KEY`); the per-user encrypted BYOK vault stays deferred (2a remaining). Enqueue **reserves one free-tier credit server-side**; release on terminal failure/cancel, keep on success. The worker must mirror the client's exact reel/analysis field shapes (single source of truth is `processReel` + `addReel`).

  **State machine + API contract.**
  - `POST /api/ingest/enqueue {url, source}` (Bearer ID token) → validate + dedup (existing reel OR active job with same normalized URL) → reserve credit → create placeholder reel (`ingestStatus: 'queued'`) → create `users/{uid}/ingestJobs/{jobId}` → forward to DO → `201 {ok, jobId, reelId, status}` or `409 duplicate` / `403 limit-reached`.
  - `POST /api/ingest/webhook/{jobId}?token=…` — Apify fires on run terminal state; worker validates the token (constant-time compare) then calls the DO.
  - `POST /api/ingest/cancel {jobId}` → DO aborts the Apify run (best-effort), marks reel `failed "Cancelled by user"`, releases credit.
  - Progress: DO writes `ingestStatus` + `ingestStep` + `errorMessage` on the reel doc → the client's existing Firestore subscription streams it (no polling endpoint needed).
  - `GET /api/ingest/jobs` → in-progress jobs for the user (queue panel).

  | # | Item | Where | Status |
  |---|---|---|---|
  | 2b.1 | Provider-key secrets (`APIFY_API_TOKEN`, `GROQ_API_KEY`) + `WORKER_URL` var + setup docs | `wrangler.jsonc`, README/worker header | ✅ (docs + `WORKER_URL` var; secrets set at deploy time) |
  | 2b.2 | Job doc model + Firestore helpers (create/get/update/query-by-url, placeholder reel write, final analyzed write) | `worker/firestore.js` | ✅ |
  | 2b.3 | `IngestQueue` Durable Object — state machine, alarm backstop, retries, abort | `worker/ingest-queue.js` + binding/migration in `wrangler.jsonc` | ✅ |
  | 2b.4 | Server-side Apify client (start run **with webhook**, poll, fetch dataset, abort) + Groq port (analyze/classify/extract) | `worker/apify.js`, `worker/groq.js` | ✅ |
  | 2b.5 | Webhook route + token validation + forward to DO | `worker/index.js` | ✅ |
  | 2b.6 | Enqueue/cancel/jobs routes + credit reserve/release wiring | `worker/index.js` | ✅ |
  | 2b.7 | Retry policy (transient vs terminal), duplicate detection, job expiry | `worker/ingest-queue.js` | ✅ |
  | 2b.8 | End-to-end test harness (curl + webhook sim) + worker logs; verify a real scrape completes via webhook | `scripts/test-ingest.mjs`, `scripts/smoke-worker.sh` | 🚧 harness done (24/24 pass) + post-deploy smoke script; live scrape pending deploy |
  | 2b.9 | (stretch) Server-side intake of `pendingUrls` so the iOS Shortcut completes without the app open | `worker/index.js` | ⬜ |

  **This pass:** fixed a systematic `firestoreRequest(env, url, init)` argument-order bug (present since 2a) that made every worker→Firestore write fail; fixed the harness's oauth mock, `urlKey` assertion, and Groq classifier mock; added an in-flight guard to the `IngestQueue` DO so the webhook and alarm backstop can't double-start a run or double-process a job; added `scripts/smoke-worker.sh` for post-deploy auth checks. `npm run lint` + `npm run typecheck` + `npm run build` + `wrangler deploy --dry-run` all pass; `node scripts/test-ingest.mjs` → 24/24. Live deploy + real Apify→Groq→Firestore cycle deferred (needs `APIFY_API_TOKEN`/`GROQ_API_KEY` secrets).

  **DoD:** `wrangler deploy` green; a real Apify→Groq→Firestore cycle completes via webhook with zero client-side scraping; cancel aborts the run and refunds the credit; duplicate URL rejected; `npm run lint` + `npm run typecheck` + `npm run build` pass (client untouched). Full client cutover to the server path is Phase **2c**.
- **2c. Client migration** — default capture flow calls the worker; job progress streams back; BYOK path behind the toggle.
- **2d. Push infra** — VAPID in the worker, subscription storage, `sw.js` push handler (iOS 16.4+, Android, desktop).

---

## Phase 3 — Retention & review

- Review queue: "Daily/Weekly Review" surface (top-N reels to revisit with summary + one-line takeaway); lightweight FSRS-style scheduler.
- Save streak + milestone badges on the dashboard.
- PWA push digest — "Your weekly reel digest is ready" → deep-links to the review queue.
- Ingest reward theater: progress labels, success toast with the top takeaway → "View in Library."

---

## Phase 4 — Multi-platform + tool extraction

- Generalize the pipeline to TikTok, YouTube Shorts, X/Twitter (Apify actors exist for all). Reposition: "video knowledge base."
- Tool/resource extraction with verified URLs (extend entity extraction + URL verification pass).

---

## Phase 5 — Create-from-library + exports

- "Create from your library": select N reels → AI generates a one-page brief / outline / social post / newsletter draft.
- Exports: Markdown (Obsidian-compatible tree), PDF, improved CSV/JSON.

---

## Phase 6 — Monetization

- Freemium → Pro: free tier = limited credits (server-enforced) → Pro subscription (Lemon Squeezy or Paddle; target $5-8/mo; COGS < $0.01/reel).
- Entitlement enforcement server-side; upgrade/downgrade webhooks; Pro gates multi-platform, review queue, exports, priority processing.
- Growth analytics: MRR, activation (first reel added), retention (review-queue opens).

---

## Sequencing rationale

- **0 → 1 → 2** are production readiness and prerequisites for everything that follows (monetization and push need the server layer; multi-platform is cheaper to build once on the server pipeline).
- **3/4/5/6** maximize retention before monetization; multi-platform before creation (creation works best across content types).
- BYOK compatibility maintained through Phase 2 so nothing breaks for existing users.

## Verification per phase

`npm run lint` + `npm run typecheck` + `npm run build` + `wrangler deploy`, plus manual QA on mobile + desktop.
