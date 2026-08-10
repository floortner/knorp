# Mobile app roadmap

> **Status: FOR LATER — not scheduled.** Analysis captured from the Capacitor iOS spike
> (`spike/capacitor-ios`), to pick up if/when the mobile app is productionised. Nothing here is committed
> to a milestone. The web app/PWA is unaffected by all of it.
>
> **Updated 2026-08-10 after the TTS pivot** (`docs/tts-build-plan.md`): narration is now pre-generated
> ElevenLabs mp3 clips resolved via `POST /speech/batch` — platform-agnostic by design. **On-device TTS is
> superseded** (it was this doc's old top item), and the feature ranking below was redone around that.

## Context

The spike proved the family app runs as a native iOS shell from the **same `src/`** — bearer-token transport
against the live API, safe-area handling, web build untouched. Two tracks remain to decide **how far to take
it**: how *native it feels* (§1) and how far it works *offline* (§2).

Framing that shapes everything: most native capabilities below are **Capacitor plugins → shared JS, one
codebase, work on iOS + Android, no-op on web.** Exactly one (the home-screen widget) is *truly* native
per-platform code — flagged where it appears. And all recommendations respect the product's stated values
(ROADMAP §D): **calm feedback, no dark patterns, no push/leaderboards/loss-mechanics aimed at the student.**

## Priorities — bang for the buck (updated 2026-08-10)

Stack and architecture stay intact for everything here (same `src/`, same API; the widget adds one small
one-way native bridge). In order:

1. **Audio-session category fix** — trivial, and a correctness *gate*: without it the narration clips are
   mute for every iPhone with the silent switch on (§1 Tier 1).
2. **Offline Level 1 (B + E + F)** — ~1 day; stops the app logging students out on a dropped connection,
   the single worst mobile failure mode today (§2).
3. **Haptics + branded splash/icon** — nearly free, big "real app" payoff (§1 Tier 1).
4. **Home-screen widget** — the flagship. Most differentiated, perfectly values-aligned, and the only item
   worth real native code; the bridge keeps the architecture intact (§1 Tier 2).
5. **App shortcuts / quick actions** — cheap native garnish (§1 Tier 2).
6. **G — durable telemetry queue** — small hardening so queued answers can't be evicted (§2).

Product-gated, later: offline lessons (Level 3 + H), parent-side local notifications (Tier 3).

---

## 1. Native feel

### Tier 1 — ship with the mobile app (all shared-code)

- **Audio session config** — *now the top item; critical + easy to miss.* All narration is `<audio>` mp3
  playback in the WebView, and iOS mutes WebView media when the **silent switch** is on. Set the
  audio-session category to `playback` so clips play regardless — without it the reading app is silent for
  half its users.
- ~~**Native on-device TTS**~~ — **superseded by the ElevenLabs clip pipeline** (`docs/tts-build-plan.md`).
  The app plays pre-generated clips via `POST /speech/batch` + presigned URLs, which works identically in a
  Capacitor WebView: same 4 narrator voices on every platform, zero plugins, zero per-platform voice drift.
  Do **not** reintroduce system voices, even as a fallback — robotic synthetic voices are exactly what user
  testing rejected ("off-putting, can't focus"); the designed fallback for a missing clip is silence + chime,
  on mobile as on web.
- **Haptics** (`@capacitor/haptics`) — a soft success tap on a correct answer, a gentle bump on tap. Delight
  for the students, and *calm* (not a dark pattern). Trivial effort, big "real app" payoff.
- **Branded splash + app icon** (`@capacitor/splash-screen`) — Nepo on launch instead of a white flash.
  Table-stakes native polish.

### Tier 2 — the flagship + garnish

- **Home Screen Widget** — *promoted: the differentiated mobile feature.* A small widget showing the
  **buddy + today's goal ring** ("2/3 diese Woche") or the streak flame. Glanceable, calm, *no notification
  nagging* — the most "wow, native" feature and perfectly values-aligned.
  **⚠️ The one item needing real per-platform native code**, kept architecture-intact via a **one-way
  bridge**: a tiny plugin writes `{buddy, goalDone, goalTarget, streakDays}` to the platform's shared store
  (iOS App-Group `UserDefaults`, Android `SharedPreferences`) whenever the web app refreshes `/me` or
  completes a session; a SwiftUI WidgetKit widget and a Glance widget render that snapshot. No network in
  the widget, no new API, stale data simply shows the last known state. Breaks the pure one-codebase story —
  worth it as the flagship follow-up once Tier 1 has shipped.
- **App Shortcuts / Quick Actions** — long-press the icon → "Heute üben" jumps into a session. Cheap, native.

### Tier 3 — handle with care (values tension)

- **Local notifications — only as a parent-controlled, opt-in, gentle reminder** (`@capacitor/local-notifications`).
  *Not* push. A **parent-set** "Zeit zum Üben? 🦉" at a chosen time is defensible *if* opt-in, calm, and never
  streak-shaming. Sits right next to the "no push to the student" line, so ship it framed as a parent tool, and
  probably only after the beta says families want it. The weekly parent email (ROADMAP D6) already carries
  most of this load.

### Recommend AGAINST (would violate the app's own values — ROADMAP §D)

- **App-icon badge counts** (the red "1") — a nagging dark pattern; exactly what "no dark patterns" rules out.
  *(Distinct from the in-app achievement **badges** in D5 — those are great.)*
- **Push notifications to the student**, streak-loss nudges, countdowns / Live Activities — all against the
  "deliberately not recommended" list.

---

## 2. Offline

Two facts shape this: in a Capacitor app the **web assets are bundled** (app opens with zero connectivity —
better than the PWA precache); but **iOS WKWebView has unreliable service-worker support**, so anything
leaning on the Workbox SW (runtime read-caching, background sync) must move to app level.

A third fact since the TTS pivot: **narration degrades gracefully offline by design.** A clip that can't be
fetched means silence + chime — the same contract as a not-yet-synthesized clip online. So audio never
*blocks* an offline level; caching clip bytes (H) is an enhancement on top of offline lessons, not a
prerequisite.

### Already true today (Level 0)
- App shell + all assets load offline (bundled).
- The **attempt telemetry queue** survives offline: `src/lib/telemetry.ts` queues failed `POST /attempts` in
  **localStorage** (not Workbox), 48 h / 500-cap, replays on reconnect. The backend's `attempt_idempotency`
  migration makes replay safe. So a blip mid-lesson never loses the student's answers.

### The levels

| Level | Capability | Requires | Effort |
|---|---|---|---|
| **0** ✅ | Opens offline; answers queue through a blip and sync later | — (works today) | done |
| **1** | Stay logged in offline; graceful "du bist offline" states; SW dropped in native | B + E + F | ~1 day |
| **2** | Browse home / progress / achievements offline (read-only) | + A | ~few days |
| **3** | **Complete lessons offline** ("practice on the train") | + C (± H for audio) | big (product) |

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
  attempt queue to Preferences/SQLite so queued student answers can't be lost. *(Small.)*
- **H — Offline clip audio (new with the TTS pivot; pairs with C).** Presigned clip URLs expire (~1 h stable
  window), so offline audio means caching the **mp3 bytes, not URLs**: when pre-fetching a session (C), also
  run its `speech/batch` and store the clips keyed by text (Capacitor Filesystem/SQLite — Cache Storage is
  SW-adjacent and unreliable in WKWebView); `playClip` prefers the local copy when offline. Clips are ~50 KB
  ×12 per session — trivial space. Without H, offline lessons still work, just silent. *(Medium.)*

### Recommendation
For a beta, **Level 1** is the cheap sweet spot (B + E + F): the app already opens and preserves answers
offline; the missing piece is just not logging the student out on a dropped connection + dropping the redundant
SW. **Level 3** (offline lessons) is the genuinely valuable "practice without wifi" feature — but a product
decision, best scoped **after the beta reveals whether families need it**; take **H** in the same pass so the
train ride has a voice, not just a chime.

---

## Related / productionising notes (separate from the above)
- Spike branch `spike/capacitor-ios`: Capacitor config, `src/lib/native.ts` (bearer transport), safe-area fix
  in `AppShell`.
- Token storage: iOS **Keychain** (vs. the spike's Preferences).
- Distribution: Apple **Developer Program + TestFlight** for wireless beta delivery to families; **Kids
  Category** compliance: no ads/trackers (none present), but the required **parental gate no longer exists** —
  the PIN was removed 2026-07-22 (ROADMAP), so a gate must be (re)designed before any Kids-Category submission.
