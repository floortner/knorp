# SPEC — besserlesenschreiben **Frontend**

The client SPA for the adaptive German literacy tutor. **Separate repo/folder** from the backend.
This app is a pure HTTP client — it holds no business logic about *what* to drill, only *how* to render
exercises the backend serves and how to report what happened. **Screens & interactions are iterated
separately in Claude Design; this spec defines structure, data flow, and the API contract it consumes.**

> **Governed by `../ARCHITECTURE.md`** (versions, API rules, errors, logging, hosting, media). Read `./AGENTS.md` first, then `../ARCHITECTURE.md`, then this file. On any conflict, ARCHITECTURE wins. The app is **free** — access is staff-approval-gated, and no payment UI exists anywhere (ARCHITECTURE §1b/§9).

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
/onboarding       welcome (buddy intro) → choose buddy (8 Lernbuddies, Nepo default) → choose weekly goal
/app
  ├ /lernen       home: greeting, unit cards (title/subtitle/status), ✨ generated-lecture card, reward strip, START
  │   └ /lesson   exercise runner (one renderer per contract type — §3), feedback, confetti on complete; sessions
  │               open with a teaching intro card (session.intro: mascot + Merksatz + "Los geht's!") —
  │               bank sessions carry the unit's Merksatz, generated lectures their own intro
  ├ /erfolge      achievement standing (Silber→Gold), stars this week, stars-to-next, weekly bars, monthly heatmap, streak
  ├ /profil       editable name, buddy picker, "aktiv seit", streak, stars, Ton toggle, login email, Eltern-Bereich CTA
  └ /chat         message thread with trainer Angelika + input; 📷 homework upload — the photo shows as
  │               a chat message, the review status/verdict comes back as trainer bubbles (§9)
/parent           PIN gate → trainer actions (unlock next, reset progress, delete chat)
```

**Tabs** (bottom nav, mobile): `lernen · erfolge · chat · profil`. Parent area reached from profile, **PIN-gated**.

**The app is free.** No price, paywall, or buy button exists anywhere — child or parent view. The ✨ lecture
card requests `POST /sessions {source:'llm'}` (loading state: generation takes a few seconds) and falls back
to a bank session with a friendly note when the LLM is unavailable (503).

---

## 3. Exercise renderers (the core)

The backend serves a `session` = ordered `Exercise[]`. Render one at a time. The source of truth is the
backend Zod union in `backend/src/contract/exercise.ts`. Each renderer: shows the prompt, captures the
answer, gives feedback, **emits telemetry**.

> **The Vokaltraining content set was dropped 2026-07-13** (ROADMAP.md §F) — the 14-type program described
> in earlier revisions of this section (Wortraster, kurz/lang-Vokal, Quatschwörter, Komposita, Wortfamilien)
> no longer exists. The contract currently holds a single stand-in type; training types, sequence, and word
> lists are being redesigned from scratch. Add new types via `ExerciseView.tsx`'s dispatch as they're
> designed (ROADMAP.md §C2 has the playbook).

Discriminated union on `type` (currently):

```ts
type Exercise =
  | { type:'placeholder'; id; prompt:string; options:string[]; answer:string; praise } // single-choice stand-in
```

Each carries optional `audioUrl` (and `syllableAudio?`) for pre-generated voice, plus `skillTags`.

**Interaction pattern:** `placeholder` renders via the generic `SingleChoiceExercise` — tap one option →
correct/wrong. States: `idle | correct | wrong`. On correct: chime + speak the answer + `praise`, advance.
On wrong: buzz + "Nochmal versuchen", allow retry. Confetti/fanfare on session complete. This state machine
and the `ExerciseCard`/`ChoiceTile`/`useAnswer` scaffolding are reusable for whatever training types replace
the dropped 14 — the Vokaltraining-specific mechanics (Wortraster grid, syllable-tile reordering,
sentence-token tapping) were deleted along with their renderers.

---

## 4. Telemetry — emit one attempt per answered item

**This is the product's spine.** Every renderer must time and report each answer.

```ts
// start a timer when the item mounts/becomes visible
const startedAt = performance.now();

// Derive prompt + expected per type (see features/exercises/derive.ts — pure and total over the union).
// The backend stores both columns NOT NULL, so never emit undefined. Currently: placeholder → prompt =
// ex.prompt, expected = ex.answer. Grow this switch as new training types are added (ROADMAP.md §F/§C2).
const { prompt, expected } = promptAndExpected(ex);

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

- If `ex.audioUrl` present → play it (and `syllableAudio[i]` for syllable-wise playback in `sylarrange`).
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
GET  /chat/{id}                POST /chat/{id}            # history messages may carry imageUrl (homework bubbles)
POST /homework                 GET  /homework/{id}        # no /confirm — staff reviewer is the human gate (§9)
POST /parent/verify-pin        POST /parent/unlock-next   POST /parent/reset   POST /parent/reset-chat
```

TanStack Query keys: `['me']`, `['units']`, `['session', id]`, `['progress', profileId]`, `['chat', profileId]`.
Invalidate `['me']` (stars/streak) + `['progress']` + `['units']` after `/sessions/{id}/complete`.

**Types are generated, never hand-written.** `src/lib/api.gen.ts` is produced from the backend OpenAPI via
`npm run gen:api` (`openapi-typescript`) and **committed**; CI re-runs it and fails on any diff (the contract
drift gate). Never hand-edit `api.gen.ts` — change the backend Zod schema and regenerate. `api.ts` is the
hand-written transport wrapper on top of those types.

**429 handling:** ★ ops are free but capped per day (backend `LLM_SESSIONS_PER_DAY` / `CHAT_MESSAGES_PER_DAY`).
Over cap the backend returns `429 RATE_LIMITED` with a kindgerechte message — surface it through the normal
error paths (the message is written for the child); no special routing. Nothing in this app emits or handles 402.

---

## 8. Parent area

- Reached from `/profil`; entry requires `POST /parent/verify-pin` → hold the returned parent token for ~15 min.
- **Trainer actions:** unlock next unit; reset progress; delete chat — the whole conversation incl. homework photos, learning progress kept (each destructive, behind a confirm dialog).
- **No billing.** The app is free (approval-gated, ARCHITECTURE §1b/§9); there is no supporter/credit UI.
- No engagement/streak-pressure mechanics tied to anything monetary, anywhere.

---

## 9. Homework "Foto & verbessern" flow (in the Chat tab)

The human gate is a **trained professional (staff reviewer)**, not the parent — see `../ARCHITECTURE.md` §11
and `../backend/SPEC.md` §10. This `-web` app **uploads and tracks status only**; it never shows the raw LLM
draft and has **no confirm/edit UI** (the reviewer portal `-review` owns that, and is not part of this repo).

1. The 📷 button next to the chat input opens the camera/picker → `POST /homework` (multipart). The photo
   appears as a chat message (the backend serves it back as a durable bubble in `/chat` history). Consent
   copy states the photo is reviewed by a trained professional ("eine Fachkraft") to tailor lessons.
2. `GET /homework/{id}` is polled (with backoff) while in review; the trainer's status bubble reflects
   `pending_analysis` / `pending_review` → `reviewed` / `rejected`. Never display a draft state.
3. On `reviewed`, the status bubble carries the **authoritative** result (topic + suggested focus from
   `reviewedAnalysis`) — read-only, no accept/reject.
4. The validated focus shapes the **next** generated lecture; surface that session in `/lernen` when it
   appears. There is no family confirm step and the child is never blocked while a photo is in review.
- Children's handwriting OCR is unreliable → the mandatory human gate is the **staff reviewer**, whose verdict
  is authoritative (the former parent-confirm step is removed). The upload is **not** PIN-gated — it lives in
  the child-facing chat by product decision; the professional-in-the-loop pipeline is unchanged.

---

## 10. Env & build
```
VITE_API_BASE=        # backend URL
VITE_PWA=true
```
- PWA manifest: app name, the prototype's "b" mark icon (teal #27A99B), maskable icons, standalone display.
- Mobile-first responsive; test at 390px and tablet widths.

## 11. Acceptance checks
- Every answered item produces exactly one `/attempts` call with a sane `timeMs`.
- App renders every exercise type in the current contract (currently just `placeholder`) from
  backend-served JSON with no hardcoded lesson data.
- `dyslexicFont` + `fontScale` visibly change rendering; `soundOn` mutes all audio.
- No price/paywall/buy control is reachable from the child tabs — only from `/parent` behind the PIN.
- Works installed as a PWA; attempts queue and sync after an offline blip.
