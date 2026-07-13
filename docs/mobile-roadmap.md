# Mobile app roadmap

> **Status: FOR LATER — not scheduled.** Analysis captured from the Capacitor iOS spike
> (`spike/capacitor-ios`), to pick up if/when the mobile app is productionised. Nothing here is committed
> to a milestone. The web app/PWA is unaffected by all of it.

## Context

The spike proved the family app runs as a native iOS shell from the **same `src/`** — bearer-token transport
against the live API, safe-area handling, web build untouched. Two tracks remain to decide **how far to take
it**: how *native it feels* (§1) and how far it works *offline* (§2).

Framing that shapes everything: most native capabilities below are **Capacitor plugins → shared JS, one
codebase, work on iOS + Android, no-op on web.** Exactly one (the home-screen widget) is *truly* native
per-platform code — flagged where it appears. And all recommendations respect the product's stated values
(ROADMAP §D): **calm feedback, no dark patterns, no push/leaderboards/loss-mechanics aimed at the child.**

---

## 1. Native feel

### Tier 1 — signature wins (ship with the mobile app; mostly shared-code)

- **Native on-device TTS** — *the highest-value one.* This is a reading app for kids who struggle to read;
  audio is core, not polish. `@capacitor-community/text-to-speech` gives high-quality iOS German system
  voices, **offline, zero latency, zero Polly cost** — and could be the *answer* to the deferred TTS pipeline
  on mobile (Polly stays the web story). Covers word pronunciation, praise, instructions.
- **Audio session config** — critical + easy to miss: iOS mutes web/TTS audio when the **silent switch** is
  on. Set the audio-session category to `playback` so word audio plays regardless — without it the reading
  app is silent for half its users.
- **Haptics** (`@capacitor/haptics`) — a soft success tap on a correct answer, a gentle bump on tap. Delight
  for 6–9-year-olds, and *calm* (not a dark pattern). Trivial effort, big "real app" payoff.
- **Branded splash + app icon** (`@capacitor/splash-screen`) — Nepo on launch instead of a white flash.
  Table-stakes native polish.

### Tier 2 — high-delight, more work, on-brand

- **Home Screen Widget** (the "phone start screen" idea, done right) — a small **WidgetKit** widget showing
  the **buddy + today's goal ring** ("2/3 diese Woche") or the streak flame. Glanceable, calm, *no
  notification nagging* — the most "wow, native" feature and perfectly values-aligned.
  **⚠️ The one item needing real per-platform native code** (a Swift widget + an Android widget reading a
  shared store the web app writes) — breaks the pure one-codebase story. Worth it as a flagship follow-up.
- **App Shortcuts / Quick Actions** — long-press the icon → "Heute üben" jumps into a session. Cheap, native.

### Tier 3 — handle with care (values tension)

- **Local notifications — only as a parent-controlled, opt-in, gentle reminder** (`@capacitor/local-notifications`).
  *Not* push. A **parent-set** "Zeit zum Üben? 🦉" at a chosen time is defensible *if* opt-in, calm, and never
  streak-shaming. Sits right next to the "no push to the child" line, so ship it framed as a parent tool, and
  probably only after the beta says families want it. The weekly parent email (ROADMAP D6) already carries
  most of this load.

### Recommend AGAINST (would violate the app's own values — ROADMAP §D)

- **App-icon badge counts** (the red "1") — a nagging dark pattern; exactly what "no dark patterns" rules out.
  *(Distinct from the in-app achievement **badges** in D5 — those are great.)*
- **Push notifications to the child**, streak-loss nudges, countdowns / Live Activities — all against the
  "deliberately not recommended" list.

### Recommendation
Ship **Tier 1 with the mobile app** — mostly shared-code plugins, and TTS + audio-session **materially improve
the product**, not just the vibe. Add haptics + splash in the same pass (nearly free). Hold the **widget** as
the flagship follow-up (real native work). Treat **local notifications** as a cautious, parent-side, post-beta
experiment.

---

## 2. Offline

Two facts shape this: in a Capacitor app the **web assets are bundled** (app opens with zero connectivity —
better than the PWA precache); but **iOS WKWebView has unreliable service-worker support**, so anything
leaning on the Workbox SW (runtime read-caching, background sync) must move to app level.

### Already true today (Level 0)
- App shell + all assets load offline (bundled).
- The **attempt telemetry queue** survives offline: `src/lib/telemetry.ts` queues failed `POST /attempts` in
  **localStorage** (not Workbox), 48 h / 500-cap, replays on reconnect. The backend's `attempt_idempotency`
  migration makes replay safe. So a blip mid-lesson never loses the child's answers.

### The levels

| Level | Capability | Requires | Effort |
|---|---|---|---|
| **0** ✅ | Opens offline; answers queue through a blip and sync later | — (works today) | done |
| **1** | Stay logged in offline; graceful "du bist offline" states; SW dropped in native | B + E + F | ~1 day |
| **2** | Browse home / progress / achievements offline (read-only) | + A | ~few days |
| **3** | **Complete lessons offline** ("practice on the train") | + C | big (product) |

### The changes
- **A — App-level read caching.** `/me`, `/units`, `/progress` are cached by Workbox `NetworkFirst` (dead in
  WKWebView). Move to **React Query persistence** backed by Capacitor Preferences/SQLite. *(Medium.)*
- **B — Offline-tolerant auth.** The boot `/me` probe treats a network error like a logout → bounces to login
  even with a valid token. Distinguish `401` (real logout) from a network error (stay authenticated from
  cached `/me`). *(Small — highest-value small change.)*
- **C — Pre-cached offline lessons.** A lesson needs a session from `POST /sessions`, which can't run offline.
  Pre-fetch + cache **bank** session(s) while online; `LessonRunner` consumes a cached one offline (✨ LLM
  lessons stay online-only). **Product decision** (how many, which units) — session generation is server-side
  by design. *(Big.)*
- **D — Graceful degradation.** Chat, homework upload, ✨ generation are online-only. Detect offline via the
  Capacitor **Network** plugin → calm disabled state instead of error toasts. *(Medium.)*
- **E — Stronger flush triggers.** Also flush on **app-resume** (Capacitor App plugin) + Network status change
  (WKWebView fires `online` less reliably); extend queuing to session-complete. *(Small.)*
- **F — Drop the PWA service worker in native builds.** Redundant + can misbehave; wire `VITE_PWA=false` into
  `vite.config` for the native build. *(Trivial.)*
- **G — Durable queue storage (hardening).** localStorage can be evicted under iOS storage pressure; move the
  attempt queue to Preferences/SQLite so queued child answers can't be lost. *(Small.)*

### Recommendation
For a beta, **Level 1** is the cheap sweet spot (B + E + F): the app already opens and preserves answers
offline; the missing piece is just not logging the child out on a dropped connection + dropping the redundant
SW. **Level 3** (offline lessons) is the genuinely valuable "practice without wifi" feature — but a product
decision, best scoped **after the beta reveals whether families need it**.

---

## Related / productionising notes (separate from the above)
- Spike branch `spike/capacitor-ios`: Capacitor config, `src/lib/native.ts` (bearer transport), safe-area fix
  in `AppShell`.
- Token storage: iOS **Keychain** (vs. the spike's Preferences).
- Distribution: Apple **Developer Program + TestFlight** for wireless beta delivery to families; **Kids
  Category** compliance (the PIN gate qualifies; no ads/trackers — none present).
