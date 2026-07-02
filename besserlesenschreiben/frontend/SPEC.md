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
/onboarding       welcome (buddy intro) → choose buddy (Nepo|Stella) → choose weekly goal
/app
  ├ /lernen       home: greeting, unit cards (title/subtitle/status), ✨ generated-lecture card, reward strip, START
  │   └ /lesson   exercise runner (14 renderers), feedback, confetti on complete; sessions
  │               open with a teaching intro card (session.intro: mascot + Merksatz + "Los geht's!") —
  │               bank sessions carry the unit's Merksatz, generated lectures their own intro
  ├ /liga         league (Silber→Gold), stars this week, stars-to-next, weekly bars, monthly heatmap, streak
  ├ /profil       name, buddy, "aktiv seit", streak, stars, weekly activity, progress rows, contact-trainer CTA
  └ /chat         message thread with trainer Angelika + input
/parent           PIN gate → trainer actions (unlock next, reset) + homework upload & status
```

**Tabs** (bottom nav, mobile): `lernen · liga · profil · chat`. Parent area reached from profile, **PIN-gated**.

**The app is free.** No price, paywall, or buy button exists anywhere — child or parent view. The ✨ lecture
card requests `POST /sessions {source:'llm'}` (loading state: generation takes a few seconds) and falls back
to a bank session with a friendly note when the LLM is unavailable (503).

---

## 3. Exercise renderers (the core)

The backend serves a `session` = ordered `Exercise[]`. Render one at a time. **14 types** — the owner's
**Vokaltraining program** (FRESCH-style: Wortraster, kurz/lang-Vokal, Quatschwörter, Komposita,
Wortfamilien). The source of truth is the backend Zod union in `backend/src/contract/exercise.ts`.
Each renderer: shows the prompt, captures the answer, gives feedback, **emits telemetry**.

Discriminated union on `type`:

```ts
type Exercise =
  | { type:'raster';      id; word; onset; vowel; coda; tiles:string[3]; praise }            // Wortraster: Anfang · Vokal · Ende
  | { type:'findvowel';   id; word; letters:string[]; answer:string; praise }                // tap the Selbstlaut in the word
  | { type:'realword';    id; word; answer:'wort'|'quatsch'; praise }                        // echtes Wort oder Quatschwort?
  | { type:'fixvowel';    id; pseudo; vowel; options:string[]; answer:string; praise }       // Hend + a → Hand
  | { type:'swapvowel';   id; word; options:string[]; answers:string[]; praise }             // swap the vowel; ANY of answers is correct
  | { type:'length';      id; word; vowel; answer:'kurz'|'lang'; hint?; praise }             // kurzer oder langer Vokal?
  | { type:'sylvalid';    id; syllable; answer:'ja'|'nein'; praise }                         // kann die Silbe klingen (hat sie einen Vokal)?
  | { type:'insertvowel'; id; pattern; word; options:string[]; answer:string; praise }       // B_ch → u → Buch
  | { type:'paircheck';   id; left; right; answer:'gleich'|'anders'; praise }                // Silbenpaare exakt vergleichen
  | { type:'pickword';    id; options:string[]; answer:string; praise }                      // one real word among vowel variants
  | { type:'sentencefix'; id; tokens:string[]; answer:string; correction:string; praise }    // tap the misspelled word in the sentence
  | { type:'compound';    id; word; parts:[string,string]; options:string[]; answer:string; praise } // pick the Grundwort's article
  | { type:'family';      id; stem; options:string[]; answer:string; praise }                // which word belongs to the Wortfamilie?
  | { type:'sylarrange';  id; word; syll:string[]; tiles:string[]; praise }                  // rebuild a multi-syllable word from tiles
```

Each carries optional `audioUrl` (and `syllableAudio?`) for pre-generated voice.

> **Gotcha:** `swapvowel` uses `answers: string[]` — several vowels can make a real word (Wind → Wand/wund)
> and tapping ANY of them is correct. Every other choice type has a single `answer`.

**Interaction patterns:**
- Single-choice (`findvowel, fixvowel, swapvowel, insertvowel, pickword, compound, family`): tap one
  option → correct/wrong. `findvowel` offers the word's letters as chips; `compound` shows the split
  (`Holz · Treppe`) and asks der/die/das.
- Binary choice (`realword, length, sylvalid, paircheck`): a large prompt card with two labelled sides —
  Echtes Wort/Quatschwort, kurz/lang, ja/nein, gleich/anders.
- Wortraster (`raster`): the program's signature visual — grey line (Anfang) · **yellow circle** (Vokal,
  "die Sonne") · grey line (Ende); tap the three shuffled parts into their slots.
- Tile-order (`sylarrange`): tap syllable tiles in sequence; compare to `syll.join('|')`; reset button.
- Sentence (`sentencefix`): the sentence as tappable tokens; tap the word with the wrong vowel; the praise
  reveals the `correction`.
- States: `idle | correct | wrong`. On correct: chime + speak word + `praise`, advance. On wrong: buzz + "Nochmal versuchen", allow retry. Confetti/fanfare on session complete.

---

## 4. Telemetry — emit one attempt per answered item

**This is the product's spine.** Every renderer must time and report each answer.

```ts
// start a timer when the item mounts/becomes visible
const startedAt = performance.now();

// Derive prompt + expected per type (see features/exercises/derive.ts — pure and total over the union).
// Some types have no scalar `word`/`answer`; the backend stores both columns NOT NULL, so never emit
// undefined. Examples:
//   raster      → prompt = word,          expected = `${onset}|${vowel}|${coda}`
//   sylarrange  → prompt = word,          expected = syll.join('|')
//   swapvowel   → prompt = word,          expected = answers.join('/')
//   sentencefix → prompt = tokens.join(' '), expected = the misspelled token
//   everything else → prompt = word/pseudo/pattern/stem, expected = answer
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
GET  /chat/{id}                POST /chat/{id}
POST /homework                 GET  /homework/{id}        # no /confirm — staff reviewer is the human gate (§9)
POST /parent/verify-pin        POST /parent/unlock-next   POST /parent/reset
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
- **Trainer actions:** unlock next unit, reset progress (confirm dialog — destructive).
- **Homework:** upload + status tracking (§9) also live here, behind the PIN.
- **No billing.** The app is free (approval-gated, ARCHITECTURE §1b/§9); there is no supporter/credit UI.
- No engagement/streak-pressure mechanics tied to anything monetary, anywhere.

---

## 9. Homework "Foto & verbessern" flow (parent-initiated)

The human gate is a **trained professional (staff reviewer)**, not the parent — see `../ARCHITECTURE.md` §11
and `../backend/SPEC.md` §10. This `-web` app **uploads and tracks status only**; it never shows the raw LLM
draft and has **no confirm/edit UI** (the reviewer portal `-review` owns that, and is not part of this repo).

1. Parent takes/uploads photo → `POST /homework` (multipart). Show pending state. Consent copy states the
   photo is reviewed by a trained professional to tailor lessons.
2. Poll `GET /homework/{id}`: surface `pending_analysis` → `pending_review` ("Wird von einer Fachkraft
   geprüft …") → `reviewed`. Never display an `analyzed`/draft state to the family.
3. On `reviewed`, show the **authoritative** result (`reviewedAnalysis`: topic, per-item correct/wrong,
   suggested focus) as a read-only summary — no accept/reject buttons.
4. The validated focus shapes the **next** generated lecture; surface that session in `/lernen` when it
   appears. There is no family confirm step and the child is never blocked while a photo is in review.
- Children's handwriting OCR is unreliable → the mandatory human gate is the **staff reviewer**, whose verdict
  is authoritative (the former parent-confirm step is removed).

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

**Phase 1.6 — content + UX polish (DONE):** auto-unlock next unit on complete; all-units-complete
celebration (mascot + fanfare + confetti); parent area (PIN gate, set-PIN, child progress, two-step reset);
profile tab Ton toggle wired end-to-end.

**Phase 2 (DONE):**
7. Chat (★ LLM) + the ✨ generated-lecture entry on `/lernen` with the lesson intro card (§2/§7).
8. Homework "Foto & verbessern" upload + status tracking (parent-area only, behind the PIN; no confirm UI —
   the staff reviewer portal owns review, §9). No billing UI — the app is free.

**Vokaltraining pivot (DONE):** the exercise set was replaced with the owner's program — the **14 types**
of §3 (Wortraster, Selbstlaute, kurz/lang, Quatschwörter, Komposita, Wortfamilien), a new 7-unit
progression with per-unit Merksatz intro cards, and a ~360-item seed bank extracted from the program docs.

> The **staff reviewer portal** (`besserlesenschreiben/reviewer`, future `-review` repo) is a **separate
> subproject** with its own milestones — see `../backend/SPEC.md` §12, Phase 2.5. It is **out of scope for this
> `-web` app**: don't build review/queue screens here. The only homework surface in `-web` is the upload +
> status tracking in milestone 8 above.

## 12. Acceptance checks
- Every answered item produces exactly one `/attempts` call with a sane `timeMs`.
- App renders all 14 exercise types from backend-served JSON with no hardcoded lesson data.
- `dyslexicFont` + `fontScale` visibly change rendering; `soundOn` mutes all audio.
- No price/paywall/buy control is reachable from the child tabs — only from `/parent` behind the PIN.
- Works installed as a PWA; attempts queue and sync after an offline blip.
