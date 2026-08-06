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
| 0.1 | Validate `userId` (regex + length + constant path) to kill service-account path injection | `worker/index.js` | ⬜ |
| 0.2 | Authenticate the relay: per-user shared secret required on every worker call + per-IP rate limit | `worker/index.js` | ⬜ |
| 0.3 | Harden CORS (restricted origin) + sanitize error responses (stop leaking internals) | `worker/index.js` | ⬜ |
| 0.4 | Strengthen Firestore rules: field-level validation, restrict writes to `pendingUrls`/`settings`, block bulk abuse | `firestore.rules` | ⬜ |
| 0.5 | Real master-key limit enforcement: transactional counter + gate in the queue, not just the submit button | `ApiKeyContext.tsx`, `useScrapeQueue.ts` | ⬜ |
| 0.6 | `clearAllUserData` clears `pendingUrls` + parent doc | `services/userData.ts` | ⬜ |

**DoD:** external security review of worker + rules passes; the relay cannot write outside the caller's own `pendingUrls`.

---

## Phase 1 — Client data-layer reliability + bug fixes

1. Kill mutation refetch storms — optimistic local writes + single Firestore subscription (`useReels`, `useCollections`).
2. Fix N+1 notes query — batch by reelIds, lazy-load on panel open (`ReelCard`, `useNotes`).
3. Pagination ("load more") + Firestore persistent cache for offline.
4. Service worker: precache at install, versioned caches + prune (`public/sw.js`).
5. Correctness bugs: `handleRetroactiveAutoAssign` stale closure, dashboard gradient keys, `keepReels` no-op, unify the 3 taxonomies, de-dupe the two scrape/poll pipelines, delete dead code.
6. CI: lint + typecheck + smoke test gate in `deploy.yml`; minimal error-tracking sink.

---

## Phase 2 — Thin server layer (the unlock)

Grow the Cloudflare Worker into the backend. Dual-mode: new users default to server-backed; existing BYOK users keep working (toggle in Settings).

- **2a. Worker API foundation** — Firebase ID-token verification (JWKS), typed `/api/*` routes, server-side key vault (provider keys in Worker secrets/KV; per-user keys encrypted), entitlements/credits ledger in Firestore (transactional), per-user rate limits.
- **2b. Server-side ingestion** — move Apify→Groq→Firestore into the worker with a real queue (Durable Object): webhook completion, retries, dedup, abort-on-cancel.
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
