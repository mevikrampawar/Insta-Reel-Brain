# UX Opportunities — Making Reel Brain More Intuitive & Addictive

> Research only. No code changes. Prepared against the app in `Insta Reel Brain/` (the live app source), and the empty `Insta-Reel-Brain/` repo this doc lives in.
> Primary lens: **Hick's Law** (decision time grows with number/complexity of choices) + **habit-forming UX** (Hook model: trigger → action → variable reward → investment).

---

## 1. Core Value Proposition & Core Loop

**Value proposition:** "Your brain for Instagram Reels." A user captures a reel they found interesting, and AI does everything else — scrape, transcribe, summarize, tag, classify, auto-organize — turning passive scrolling into a searchable, chat-able personal knowledge base. Zero-setup trial mode (5 free reels) removes the BYOK barrier to first value.

**Core loop (Hook model):**

```
TRIGGER   You're scrolling Instagram → hit a reel worth keeping
   ↓
ACTION    Share → copy link → paste into Reel Brain
   ↓
VARIABLE  AI does the work: summary, takeaways, tags, auto-collection
  REWARD   ("What did this actually say?") — differs each reel
   ↓
INVEST-   Library grows, categories fill, notes/collections accumulate
  MENT     → makes the app more valuable each time → return loop
```

The app already has the bones of an addictive loop: a strong external trigger (Instagram), a nearly frictionless capture path (paste / clipboard / iOS Shortcut / PWA share), AI-generated rewards, and compounding investment (the library). The gaps are in **reducing early decisions**, **making the reward moment visible**, and **creating re-engagement triggers** that pull users back between capture sessions.

---

## 2. Current User Flows (mapped)

**Onboarding (first load)**
1. `Login.tsx` — one clear CTA ("Get Started Free"). Good Hick's hygiene.
2. After sign-in: **auto-tour** (driver.js, `lib/tour.ts`) fires + **amber "5 free reels" banner** (`Layout.tsx:265`) + **empty-state onboarding** card (`DashboardView.tsx:106`). Three simultaneous "teaching moments."
3. Dashboard empty state offers a clean default path: *Copy → Paste → Build* with a single primary CTA "Add your first reel."

**Ingest (Add)** — `IngestionForm.tsx`
- Single primary action: paste URL + submit arrow. Good.
- Competing elements on one screen: clipboard banner, free-tier meter, duplicate warning, collapsible "Quick ways to add reels," live job queue, empty state.
- Each reel takes ~30–120s (scrape + analyze) shown only as phase labels (`queued → scraping → analyzing`); **no progress %, no ETA**. Completed jobs are auto-removed after 5s (`useScrapeQueue.ts:191`) — the "Done" moment is easy to miss.

**Library** — `Library.tsx` + `SearchBar.tsx` + `ReelCard.tsx`
- Header: Select / CSV / Stats buttons.
- Search: input + button + **AI Search vs Keyword toggle**.
- Filter bar: 4 status pills + collection dropdown + sort dropdown (6 options) + **Filters** button (reveals content type ×8, sentiment ×4, quality ×4, creator dropdown, date ×4).
- **~30+ simultaneous choices before the user even reads a reel.** Progressive disclosure exists (Filters are behind a button) but status pills + sort + collection dropdown are all visible by default.
- `ReelCard`: 6–8 icon-only actions (open original, re-analyze, re-scrape, notes, add-to-collection, delete) + summary + metrics + "More details" expander. **No single primary action; the card body itself is not clickable.**

**Chat** — `Chat.tsx`
- Strong: contextual suggestion chips (6), streaming answers, clickable source citations. The most "rewards-first" surface in the app.

**Collections** — `Collections.tsx`
- Per-row: rename / add-reel / delete / expand, plus header-level Select, **Auto-Assign All**, and batch Merge/Delete. "Auto-Assign All" is the closest thing to the product's magical promise but is buried here.

**Data Sources / Graph / Settings** — niche utility views (analytics, 3D graph, API keys + setup guides).

---

## 3. Friction & Hick's Law Violations (where decisions pile up)

### F1. Onboarding competes with itself
First load fires an auto-tour, an amber "go to Settings" banner, *and* the onboarding card. A new user has three simultaneous instructions → three mental threads. The tour covers 6 nav destinations before the user has done a single task.
**Fix:** one primary path ("Add your first reel") at a time; demote the Settings/keys prompt behind actual need; shorten the tour to 3 steps that end with the *first reel added*.

### F2. Library = decision overload on arrival
For the 80% task ("find a reel I saved"), the screen fronts 4 status pills, a 6-option sort, a collection dropdown, a 2-mode search, and a filter panel with ~20 more options. Each extra visible option taxes the decision. Sort-by is only meaningful past ~20 reels; status pills matter only when something is processing/failed.
**Fix:** default Library to *just search + newest grid*. Move status pills, sort, collection, and filters behind one "Filter" affordance with a count badge (already partially done — extend it). Auto-hide sort until reels > threshold.

### F3. ReelCard has no obvious "primary action"
6–8 equally-styled icon buttons + no clickable card body = the user must parse each glyph to decide what to do. Ambiguous CTAs are a Hick's violation (uncertainty = added choice time). Also, the *actual* reward of the whole app (reading the AI summary) is treated as a static block rather than a destination.
**Fix:** make the card body open a detail view (or expand), give one clearly-weighted action (e.g., "Read summary" / "Open in Instagram"), and demote destructive/rare actions into a "⋯" overflow menu.

### F4. The reward moment is invisible
Ingest shows only `Scraping… / Analyzing…` with no progress or ETA, and completed jobs vanish after 5s. The variable reward ("wow, it found that key takeaway") is the heart of the loop — right now it's easy to never see it.
**Fix:** show a progress bar + "what AI is doing now" messages, keep the completed card until the user dismisses it, and flash a success toast → "View in Library" that lands directly on the new reel (highlight already exists via `highlightReelId`).

### F5. The "magic" is buried
Auto-organization ("AI organizes your reels") — arguably the best single reward — lives on the Collections tab behind "Auto-Assign All." New users won't find it; reels without categories feel inert.
**Fix:** surface auto-organization as part of the ingest success moment and on the Dashboard ("Your 3 new reels were filed under Fitness & Tech — tap to see").

### F6. Mixed UI conventions
Bulk add-to-collection in Library uses a native `prompt()` (`Library.tsx:311`) — an inconsistent, jarring pattern amid a polished custom UI. Destroy/rare actions (delete, re-scrape, re-analyze) sit at the same visual weight as everyday actions.

### F7. Capture method sprawl (good power, hidden default)
Paste / clipboard banner / iOS Shortcut / PWA share are all valid, but the "Quick ways to add reels" collapsible is collapsed and the setup guides live 2 tabs deep in Settings. Users who don't discover share-sheet capture stay on the manual paste path forever.
**Fix:** pick a **default capture path** for each platform (iOS: Shortcut guide as the primary pitch; Android: PWA install prompt), and offer it at the exact moment value is first demonstrated (after the first successful ingest).

### F8. No re-engagement machinery
The app relies entirely on the Instagram-side trigger. Nothing pulls the user *back*: no streaks, no "review your saved reels" queue, no daily/weekly digest, no badges, no push notifications (PWA possible). One-shot capture → one-shot visit risk.

---

## 4. Recommendations

### 4a. Reduce choices at decision points (Hick's Law)
1. **One primary action per screen.** Dashboard → "Add your first reel." Library → search. Ingest → the URL box. Chat → the input. Give each screen a single visually-dominant CTA and demote everything else.
2. **Library default state = search + newest grid only.** Hide status pills, sort, collection, and advanced filters behind a single "Filters (n)" button. Sort stays visible once reels > ~20.
3. **ReelCard:** one primary action (expand/read the summary or "Open in Instagram"); collapse rare/destructive actions into an overflow menu. Kill the `prompt()` in bulk add-to-collection; replace with the same collection picker pattern used per-reel.
4. **Search:** drop the AI/Keyword toggle from the default UI (default semantic, which already falls back to keyword). Power switch can live in the advanced filter panel. Users should never have to choose *how* to search.

### 4b. Progressive disclosure & clear default paths
5. **Onboarding: one track at a time.** Sequence instead of stacking: (a) welcome + add first reel → (b) on ingest success, offer "Try Chat" or "Auto-organize" → (c) only after the 5-reel trial is spent, surface the "add your own keys" prompt. Move the amber Settings banner from the first dashboard load to the moment it's actually needed (trial exhausted).
6. **Guided default per platform:** after the first ingest, show one contextual setup card: iOS → "Install the Shortcut (one tap from Instagram)"; Android/desktop → "Install the app (share-sheet)." One option, not three guides.
7. **Tour = 3 steps that end in a real action:** "This is where you paste a link" → "It appears here as it processes" → "Then you can ask it anything in Chat." Teaching by doing beats narrating six tabs.

### 4c. Make the reward visible & variable
8. **Live ingest theater:** progress bar + rotating "what AI is doing" labels ("Reading the transcript…", "Finding key takeaways…", "Filing it under Fitness…"). Success toast: "✅ Reel 3 added & analyzed — View it" → navigates to Library with the reel highlighted (infrastructure exists).
9. **Reward peek on completion:** in the toast/done card, show a one-line AI takeaway ("Top insight: …") — the variable reward users will come back for.
10. **Surfaced auto-organization:** after ingest, and on the Dashboard, call out "AI filed N new reels into your categories." Make "Auto-Assign All" one click from the Dashboard empty/stat area, not buried in Collections.

### 4d. Reduce cognitive load
11. **Consistent destructive-action treatment:** delete/clear always behind a confirm, never equal-weight with primary actions. 
12. **Cap visible chrome per card:** show creator + title + 1-line summary + tags by default; everything else behind "More details." Fewer glyphs to decode per scan.
13. **Kill competing banners:** at most one banner at a time (clipboard / keys / success), with a defined priority order.

### 4e. Design the addictive loop (investment + re-engagement)
14. **Streaks** ("Save streak": reels added on N consecutive days) — capitalize on the natural daily Instagram habit; show the streak on the Dashboard next to the activity sparkline.
15. **Weekly digest / "Review" queue:** a lightweight recurring reward — "This week you saved 12 reels; here are your 3 highest-value ones. Revisit the top 1." Turns passive capture into periodic returns. (Free — no push infra needed; just an inbox-style surface or email-less in-app feed.)
16. **Milestones & progress bars:** "Library complete" style micro-goals (25 reels saved, 10 categories covered, first collection at 5 reels) with celebratory feedback — cheap dopamine that reinforces investment.
17. **PWA push notification (future):** optional daily digest or "new insight ready" push — the biggest possible re-engagement lever, since the app is already installable and offline-capable.
18. **Variable rewards ladder:** the app already has many reward types (summary, chat answer, graph view, collection fill). Route users between them with a gentle "next thing to try" cue after each completed task, so each visit can reward differently.

---

## 5. Prioritized Improvements (impact vs effort)

Legend: **Impact** = effect on intuitiveness/retention. **Effort** = engineering cost (client-side only, per repo constraints).

| # | Change | Why it matters | Impact | Effort |
|---|--------|----------------|--------|--------|
| 1 | Ingest success toast + "View in Library" (reel highlight) | Makes the core reward visible; closes the loop | ★★★★★ | Low (highlight already implemented) |
| 2 | One primary CTA per screen; demote Settings banner to a need-triggered prompt | Removes the #1 early-decision conflict | ★★★★★ | Low |
| 3 | Library default = search + newest; hide pills/sort/filters behind "Filters" | Biggest single Hick's Law reduction (~30 → ~3 choices) | ★★★★☆ | Low–Med |
| 4 | ReelCard: clickable body + one primary action; overflow menu for rare actions | Fixes ambiguous CTA; less glyph-parsing per card | ★★★★☆ | Med |
| 5 | Progress bar + "what AI is doing" labels during ingest | Reduces anxiety/friction during 30–120s wait | ★★★★☆ | Low–Med |
| 6 | Keep completed jobs until dismissed; auto-organize callout after ingest | Reward + investment visibility | ★★★☆☆ | Low |
| 7 | 3-step "do-first" tour; kill the 6-step nav tour | Faster time-to-first-value | ★★★☆☆ | Low |
| 8 | Contextual one-click platform setup (iOS Shortcut / PWA) after first ingest | Locks in the low-friction capture habit | ★★★☆☆ | Med |
| 9 | Save streak on Dashboard | Daily re-engagement trigger | ★★★☆☆ | Low–Med |
| 10 | Replace `prompt()` for bulk add-to-collection | Consistency; removes a jarring native element | ★★☆☆☆ | Low |
| 11 | Sort hidden until >20 reels | Progressive disclosure on a rare control | ★★☆☆☆ | Low |
| 12 | Weekly digest / "Review your top reels" surface | Recurring return hook | ★★★☆☆ | Med–High |
| 13 | Milestones/badges (25 reels, 10 categories…) | Investment + reinforcement | ★★☆☆☆ | Med |
| 14 | PWA push digest (optional future) | Largest retention lever | ★★★☆☆ | High |

**Suggested 30-day sprint:** #1, #2, #3, #5 first (all Low effort, hit the two biggest loops: first-session decision load and ingest reward). Then #4, #7, #8. Streak + digest (#9, #12) are the retention phase.

---

## 6. Quick Reference — files touched by recommendations

| Area | File(s) |
|------|---------|
| Onboarding / tour / banner | `src/lib/tour.ts`, `src/components/Layout.tsx`, `src/components/DashboardView.tsx` |
| Ingest reward / progress | `src/components/IngestionForm.tsx`, `src/hooks/useScrapeQueue.ts` |
| Library decision load | `src/components/Library.tsx`, `src/components/SearchBar.tsx` |
| ReelCard primary action | `src/components/ReelCard.tsx` |
| Collections magic action | `src/components/Collections.tsx` |
| Re-engagement (streaks, digest) | `src/components/DashboardView.tsx`, new surfaces |
| Keys prompt timing | `src/components/Settings.tsx`, `src/hooks/ApiKeyContext.tsx` |
