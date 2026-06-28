# SPEC — besserlesenschreiben **Frontend**

The client SPA for the adaptive German literacy tutor. **Separate repo/folder** from the backend.
This app is a pure HTTP client — it holds no business logic about *what* to drill, only *how* to render
exercises the backend serves and how to report what happened. **Screens & interactions are iterated
separately in Claude Design; this spec defines structure, data flow, and the API contract it consumes.**

> **Governed by `../ARCHITECTURE.md`** (versions, API rules, errors, logging, hosting, payments, media). Read `./AGENTS.md` first, then `../ARCHITECTURE.md`, then this file. On any conflict, ARCHITECTURE wins.

---

## 1. Stack

- **Vite + React 19 + TypeScript** SPA (deliberately *not* Next.js — strict front/back separation; this is a client only). See `../ARCHITECTURE.md` §2 for pinned versions.
- **Tailwind CSS + shadcn/ui** for UI (responsive, mobile-first, accessible, components owned in-repo).
- **TanStack Query** for ALL server state (auth, profile, units, sessions, attempts, progress, chat).
- **React Router** for navigation.
- **PWA** (`vite-plugin-pwa`) — installable to the phone home screen, app-like.
- **Fonts:** Atkinson Hyperlegible (body, dyslexia-friendly) + Bricolage Grotesque (display) — already in the prototype.
- **No localStorage for the auth token** — prefer httpOnly cookie from backend; if header-based, keep token in memory + silent refresh.

Mobile-first: design at ~390px width first, scale up. Large tap targets (child users).

---

## 2. Screen map (ported from prototype `knorp.html`)

```
/login            email entry → 4-digit code entry → (session-expired state)
/onboarding       welcome (buddy intro) → choose buddy (Nepo|Stella) → choose weekly goal
/app
  ├ /lernen       home: greeting, unit cards (title/subtitle/status), reward strip, START
  │   └ /lesson   exercise runner (12 renderers), feedback, confetti on complete
  ├ /liga         league (Silber→Gold), stars this week, stars-to-next, weekly bars, monthly heatmap, streak
  ├ /profil       name, buddy, "aktiv seit", streak, stars, weekly activity, progress rows, contact-trainer CTA
  └ /chat         message thread with trainer Angelika + input
/parent           PIN gate → trainer actions (unlock next, reset) + BILLING/supporter section
```

**Tabs** (bottom nav, mobile): `lernen · liga · profil · chat`. Parent area reached from profile, **PIN-gated**.

**Billing UI lives ONLY in `/parent`.** The child-facing app must never render a price, paywall, or buy button.

---

## 3. Exercise renderers (the core)

The backend serves a `session` = ordered `Exercise[]`. Render one at a time. **12 types** (ported from the
prototype's `LESSONS[]`). Each renderer: shows the prompt, captures the answer, gives feedback, **emits telemetry**.

Discriminated union on `type`:

```ts
type Exercise =
  | { type:'count';    id; word; syll:string[]; answer:number; opts:number[]; praise }      // count syllables
  | { type:'gap';      id; word; syll:string[]; gapIndex; answer:string; options:string[]; praise } // fill missing syllable
  | { type:'order';    id; word; syll:string[]; tiles:string[]; praise }                     // order syllable tiles
  | { type:'rhyme';    id; word; options:string[]; answer:string; praise }                   // pick the rhyme
  | { type:'initial';  id; word; emoji; answer:string; options:string[]; praise }            // initial letter/sound
  | { type:'letter';   id; word; letters:string[]; gapIndex; answer:string; options:string[]; praise } // missing letter
  | { type:'case';     id; word; emoji?; answer:string; options:string[]; praise }           // Nomen groß / Tunwort klein
  | { type:'arrange';  id; word; syll:string[]; tiles:string[]; praise }                     // arrange letters
  | { type:'nonsense'; id; word; answer:string; options:string[]; praise }                   // echtes Wort vs Quatschwort
  | { type:'pairs';    id; tiles:string[]; pair:[string,string]; praise }                    // match rhyming pair
  | { type:'bd';       id; glyph:string; answer:string; options:string[]; praise }           // b/d/p/q discrimination
  | { type:'vowel';    id; word; letters:string[]; gapIndex; answer:string; options:string[]; praise } // ie/ei/eu
```

Each carries optional `audioUrl` (and `syllableAudio?`) for pre-generated voice.

> **Field-name gotcha:** `count` uniquely uses `opts:number[]` (numeric syllable counts); every other
> single-choice type uses `options:string[]`. This is intentional — keep them distinct, don't unify.

**Interaction patterns** (from prototype handlers):
- Single-choice (`count, rhyme, initial, case, nonsense, bd, gap, letter, vowel`): tap option → correct/wrong.
- Tile-order (`order, arrange`): tap tiles in sequence; compare to `syll.join('|')`; reset button.
- Pair-match (`pairs`): tap two tiles; correct if both in `pair`.
- States: `idle | correct | wrong`. On correct: chime + speak word + `praise`, advance. On wrong: buzz + "Nochmal versuchen", allow retry. Confetti/fanfare on session complete.

---

## 4. Telemetry — emit one attempt per answered item

**This is the product's spine.** Every renderer must time and report each answer.

```ts
// start a timer when the item mounts/becomes visible
const startedAt = performance.now();

// Derive prompt + expected per type. Some types have no scalar `word`/`answer`:
// `pairs` has no word/glyph; `order`/`arrange`/`pairs` have no scalar answer.
// The backend stores both columns NOT NULL, so never emit undefined.
const prompt =
  ex.word ?? ex.glyph ?? (ex.tiles ? ex.tiles.join(' ') : '');
const expected =
  ex.type === 'order' || ex.type === 'arrange' ? ex.syll.join('|')   // correct tile order
  : ex.type === 'pairs'                        ? ex.pair.join('+')   // the matching pair
  :                                              String(ex.answer);

// on answer:
postAttempt({
  sessionId,
  itemId: ex.id,
  exerciseType: ex.type,
  prompt,
  expected,
  given: String(chosen),
  isCorrect,
  timeMs: Math.round(performance.now() - startedAt),
  attemptNo,             // increment on retry of same item
  skillTags: ex.skillTags ?? [],
});
```

- Fire-and-forget via a TanStack Query mutation; queue + retry on offline (PWA).
- `attemptNo` increments on each retry of the same item before it's correct.
- Do **not** block the UI on the network — optimistic, background-synced.

---

## 5. Voice playback

- If `ex.audioUrl` present → play it (and `syllableAudio[i]` for syllable clapping in `count`/`order`).
- Else fall back to **Web Speech API** (`SpeechSynthesisUtterance`, `lang='de-DE'`, `rate≈0.85`) — same as prototype.
- Respect `settings.soundOn`. Gate audio init behind first user gesture (mobile autoplay rules).

---

## 6. Accessibility & settings

Driven by `profile.settings` (from `GET /profiles/{id}`, edited via `PATCH /profiles/{id}/settings`):
- `dyslexicFont` → currently toggles **extra letter/word spacing** on the (already dyslexia-friendly)
  Atkinson Hyperlegible body font. Shipping the actual **OpenDyslexic** face is a follow-up; until then the
  setting is spacing-only (don't relabel it as a font swap in the UI).
- `fontScale` → root font-size multiplier.
- `soundOn` → master audio toggle.
- High contrast, large tap targets, keyboard operability throughout (children + assistive use).

---

## 7. API client & data flow

Single typed `api.ts` wrapping `fetch`, base URL from `VITE_API_BASE`, `credentials:'include'` so the
backend's **httpOnly session cookie** rides along (auth is derived from a `/me` probe — no token in JS;
`setAuthToken`/Bearer remains only for API clients/tests). **Mirror the backend contract exactly**
(`../backend/SPEC.md` §6). Endpoints consumed:

```
POST /auth/request-code        POST /auth/verify
GET  /me                       POST /profiles            PATCH /profiles/{id}/settings
GET  /units                    POST /sessions            POST /attempts        POST /sessions/{id}/complete
GET  /progress/{id}            GET  /digest/{id}
GET  /chat/{id}                POST /chat/{id}
POST /homework                 GET  /homework/{id}        POST /homework/{id}/confirm
POST /parent/verify-pin        POST /parent/unlock-next   POST /parent/reset
GET  /billing/status           POST /billing/checkout
```

TanStack Query keys: `['me']`, `['units']`, `['session', id]`, `['progress', profileId]`, `['chat', profileId]`, `['billing']`.
Invalidate `['me']` (stars/streak) + `['progress']` + `['units']` after `/sessions/{id}/complete`.

**Types are generated, never hand-written.** `src/lib/api.gen.ts` is produced from the backend OpenAPI via
`npm run gen:api` (`openapi-typescript`) and **committed**; CI re-runs it and fails on any diff (the contract
drift gate). Never hand-edit `api.gen.ts` — change the backend Zod schema and regenerate. `api.ts` is the
hand-written transport wrapper on top of those types.

**402 handling:** a gated action returning 402 (no credits) → route the **parent** to the supporter/credit
screen in `/parent`. Never surface payment to the child view.

---

## 8. Parent area

- Reached from `/profil`; entry requires `POST /parent/verify-pin` → hold the returned parent token for ~15 min.
- **Trainer actions:** unlock next unit, reset progress (confirm dialog — destructive).
- **Supporter / billing section:**
  - Show tier + (if pay-go) credit balance from `GET /billing/status`.
  - "Förderer werden" / buy credit pack → `POST /billing/checkout` → redirect to `checkoutUrl`.
  - Optional **pay-it-forward** amount field on checkout.
  - **Transparency line:** "Diese Woche: AI-Nutzung ≈ €X · dein Beitrag hält die App am Laufen und fördert {n} Kinder."
- No engagement/streak-pressure mechanics tied to payment anywhere.

---

## 9. Homework "Foto & verbessern" flow (parent-initiated)

1. Parent takes/uploads photo → `POST /homework` (multipart). Show pending state.
2. Poll `GET /homework/{id}` until `analyzed`.
3. Show the analysis (topic, per-item correct/wrong, suggested focus) for **parent confirmation**.
4. `POST /homework/{id}/confirm {accept, edits?}` → on accept, backend folds errors into the learning
   profile and can generate a targeted session. Surface that session in `/lernen`.
- Children's handwriting OCR is unreliable → the confirm step is mandatory and parent-only.

---

## 10. Env & build
```
VITE_API_BASE=        # backend URL
VITE_PWA=true
```
- PWA manifest: app name, the prototype's "b" mark icon (teal #27A99B), maskable icons, standalone display.
- Mobile-first responsive; test at 390px and tablet widths.

## 11. Milestones (suggested order for Claude Code)

**Phase 1 (DONE, merged + CI-green):**
1. ✅ App shell, routing, tab nav, API client, auth (email-code + code-entry screens; cookie session + `/me` probe).
2. ✅ Onboarding (buddy + goal) → `POST /profiles`.
3. ✅ `/lernen` home + unit cards + session fetch.
4. ✅ **Telemetry plumbing** (`lib/telemetry.ts`): fire-and-forget `POST /attempts` with a real `timeMs`, offline queue + retry (+ 48h retention/size cap).
5. ✅ **The 12 exercise renderers** (the bulk of the work) — each emits exactly one attempt through the milestone-4 pipeline.
6. ✅ Progress (`/profil`, `/liga`) + voice + accessibility settings.

**Phase 1.5 (DONE):** error boundary + renderer safety; offline session caching (PWA runtime caching); query
correctness fixes; committed `api.gen.ts` + drift gate; flow tests.

**Phase 2 (after 1.5):**
7. Chat (★ LLM).
8. Parent area billing/supporter + homework "Foto & verbessern" flow (parent-area only, behind the PIN).

## 12. Acceptance checks
- Every answered item produces exactly one `/attempts` call with a sane `timeMs`.
- App renders all 12 exercise types from backend-served JSON with no hardcoded lesson data.
- `dyslexicFont` + `fontScale` visibly change rendering; `soundOn` mutes all audio.
- No price/paywall/buy control is reachable from the child tabs — only from `/parent` behind the PIN.
- Works installed as a PWA; attempts queue and sync after an offline blip.
