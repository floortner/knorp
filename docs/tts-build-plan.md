# BUILD PLAN: ElevenLabs TTS — 4 switchable voices, /speech lookup, kill Web Speech

> **Handoff document.** Status: **approved by Flo 2026-08-10, NOT started — zero code exists.**
> This file is self-contained: any LLM (or human) can execute it without prior conversation
> context. Follow it literally. Line numbers are hints from 2026-08-10 — always locate by the
> quoted pattern, never by number. Where this plan conflicts with repo docs, the plan wins
> (the docs get re-trued in T7). Supersedes the parked `docs/tts-narration-plan.md`.
>
> **How to pick this up:** read this file fully → read `besserlesenschreiben/backend/AGENTS.md`
> and `besserlesenschreiben/frontend/AGENTS.md` → create branch `feat/tts-voices` off `main` →
> execute T1…T8 in order, running each task's gate before moving on → open a PR (do **not**
> merge; Flo self-merges). The Operator runbook at the end is Flo's, not the implementer's.

## Context (short)

besserlesenschreiben = German literacy tutor (students 8–14; German UI copy; the app is free —
no billing anywhere). First user tests: the Web Speech API narration is "off-putting", students
can't focus. Decisions (Flo, 2026-08-10): build the ElevenLabs pipeline NOW · 4 narrator voices
(neutral styles, not buddy-themed) · student-facing "Stimme" picker in /profil with instant
preview · voice swaps = SSM config only · **Web Speech removed entirely** — real mp3 clips for
**prompt narration + answer readback only** (praise stays visual text — decided) · decoupled
`POST /speech/batch` lookup with one batch prefetch per session (chosen over payload-embedded
URLs: equal performance, no contract churn) · clips cached content-addressed in S3,
**append-only** (old voices never deleted; switching a slot back to a previous voice is instant
and free).

## Non-negotiable guardrails (re-read before every task)

1. **`/speech/batch` NEVER synthesizes.** It only computes keys + presigns (blind — no existence
   check). Synthesis exists in exactly two places: the `content:narrate` sweep and the
   LLM-session path. A missing clip 404s at play time → the client stays silent (chime/visual
   feedback still fire). This is the entire fallback model — no Web Speech, no retries.
2. **Exercise wire contract unchanged.** No `answerAudioUrl`, no fixture edits, no golden-snapshot
   changes. `exercise.mapper.ts` must emit `audioUrl: null` explicitly (`item_bank.audio_url`
   stays dormant; a raw storage key must never reach the wire).
3. **Never log clip text, answers, or URLs** — char counts + statuses only (security rule 6).
4. **Never delete anything under `audio/`** — no cleanup code, no lifecycle rule, no S3 tags on
   audio objects (the homework lifecycle rule is tag-scoped; tagging audio would get it swept).
5. **Don't touch** `storage.service.ts#keyFor` (per-user security invariant), `api.gen.ts` by
   hand (regenerate only), the `e2e/` suite, anything in `trainer/` except the `gen:api` regen.
6. Every contract change: edit Zod in `backend/src/contract/` → `npm run openapi:export` →
   `npm run gen:api` in **both** `frontend/` and `trainer/` → commit all three outputs (CI
   drift-gates all of them).
7. Commit messages end with the `Co-Authored-By:` trailer per repo convention; branch
   `feat/tts-voices` off `main`; PR at the end — do not merge.

## Reference patterns (mirror these exactly)

- **Provider module template:** `backend/src/services/llm/` — `llm.types.ts` (interface + `live`
  flag + DI symbol), `stub.provider.ts`, `llm.module.ts` (exported pure `createLlmProvider`
  factory with prod DPA-ack gate that throws at boot). Copy this structure for `services/tts/`.
- **Enum-setting template:** `appearance` — contract enum `appearanceSchema` in
  `backend/src/contract/models.ts` (~L26), `profileSchema` + `profileDetailSchema.settings`
  entries, optional field in `updateSettingsSchema`
  (`backend/src/modules/profiles/profiles.dto.ts`), `String @default` column in
  `prisma/schema.prisma` Profile block, one-line migration
  `prisma/migrations/20260808073135_add_profile_appearance/migration.sql`, projections in
  `profiles.service.ts` `view()` and `get()`. Copy all of it for `voice`.
- **Stable presign:** `storage.service.ts#signedHomeworkReadUrl(key, ttl, {stable})` (~L207) —
  quantizes the signing window so repeated calls return identical, browser-cacheable URLs.
- **Settings card UI template:** `frontend/src/app/tabs/Profil.tsx` — the Schriftgröße card
  (simple `settings.mutate` one-liner form, NOT the Aussehen optimistic variant).
- **Standalone script template:** `backend/scripts/content-import.ts` (own Prisma client, pure
  plan function + spec, `import-plan`-style).

## Ordered tasks

### T1 — Backend TTS service (`backend/src/services/tts/`, all new files)

- `tts.types.ts`:
  ```ts
  export interface TtsProvider {
    readonly name: string;   // 'elevenlabs' | 'stub'
    readonly live: boolean;
    readonly modelId: string;
    synthesize(text: string, elevenVoiceId: string): Promise<Buffer>; // mp3; throws on failure
  }
  export const TTS_PROVIDER = Symbol('TTS_PROVIDER');
  ```
- `tts.config.ts`: `ttsVoicesSchema` = Zod array, **exactly 4** entries
  `{ id: z.enum(['v1','v2','v3','v4']), label: z.string().min(1), elevenId: z.string().min(1) }`,
  ids unique; `parseTtsVoices(json: string)` returning `[]` on empty input, throwing (clear
  message) on malformed JSON when non-empty.
- `elevenlabs.provider.ts`: native fetch, no SDK.
  `POST https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}?output_format=mp3_44100_128`,
  headers `{'xi-api-key': key, 'content-type': 'application/json'}`, body
  `{ text, model_id: this.modelId }`, response = raw mp3 bytes → Buffer. One retry on
  429/5xx/network error after ~1 s; 401/403/422 throw immediately. Terminal failure →
  `ApiException(503, 'PROVIDER_UNAVAILABLE', 'Sprachausgabe ist derzeit nicht verfügbar.')`
  (find `ApiException` usage in `services/llm/` / `common/`). Log
  `{event:'tts.synthesize', chars: text.length, status}` only.
- `stub.provider.ts`: `live = false`; `synthesize` throws the same 503 (mirrors `StubLlmProvider`).
- `tts.service.ts` (`TtsService`, injectable; uses StorageService):
  - `export function audioKeyFor(text, elevenId, modelId): string` — pure, top-level export:
    `audio/tts/${elevenId}/${modelId}/${sha256hex(text).slice(0, 40)}.mp3` (node:crypto).
  - `export const SAMPLE_TEXT = 'Hallo! So klinge ich. Sollen wir zusammen lesen und üben?'`
  - `voices: {id,label,elevenId}[]` from config; `elevenIdFor(slot)` (unknown slot → slot v1);
    `live` getter.
  - `async urlsFor(texts: string[], slot): Promise<(string|null)[]>` — blind stable presign (1 h)
    of each computed key; all `null` when `!live` or `TTS_DISABLED`. No DB, no S3 HEAD.
  - `async sampleUrls(): Promise<(string|null)[]>` — the `SAMPLE_TEXT` clip per voice.
  - `async narrateForVoice(texts: string[], elevenId: string): Promise<void>` — for each unique
    text: `sharedObjectExists(key)` → skip, else check daily char budget (`TTS_CHARS_PER_DAY`,
    in-memory counter, resets by date) → `synthesize` → `writeSharedBinary(key, buf,
    'audio/mpeg')`. Concurrency ≤4 (`Promise.allSettled` batches). **Never throws** — catch per
    text, count failures, log counts.
  - `narrateAllVoices(texts)` = all 4 slots; `narrateRemainingVoices(texts, exceptElevenId)`.
- `tts.module.ts`: exported pure `createTtsProvider({apiKey, voices, modelId, isProd, dpaAck})` —
  no key OR no voices → `StubTtsProvider` (+ one warn if key set but voices empty); prod + key +
  `dpaAck !== 'true'` → throw at boot. `@Module` provides `TTS_PROVIDER` via factory from
  ConfigService, imports StorageModule, exports TtsService. (Do not register in app.module.ts in
  T1 — T2 wires consumers.)
- `config/env.ts`: replace the comment "TTS_* and BILLING_* vars removed" (~L82) with:
  `ELEVENLABS_API_KEY` (default ''), `TTS_VOICES` (default ''), `TTS_MODEL_ID` (default
  'eleven_multilingual_v2'), `TTS_DPA_ACK` (default ''), `TTS_CHARS_PER_DAY` (coerce number,
  default 200000), `TTS_DISABLED` (default '').
- Storage additions (`services/storage/storage.service.ts`):
  - `writeSharedBinary(key, content: Buffer, contentType)` and `sharedObjectExists(key)` — shared
    namespace, do NOT route through `keyFor`, no S3 tags. Local-FS branch mirrors S3 branch.
  - Rename body of `signedHomeworkReadUrl` into generalized `signedReadUrl(key, ttlS, opts)`;
    keep `signedHomeworkReadUrl` as a one-line delegate (call sites untouched).
  - `storage.controller.ts`: serve content type by key extension (`.mp3` → `audio/mpeg`, else
    `image/webp` as today).
- **Specs:** `tts.service.spec.ts` (audioKeyFor determinism + distinct per voice/model/text;
  urlsFor nulls on stub/disabled; narrate skips existing, survives provider throw, budget trip),
  `elevenlabs.provider.spec.ts` (mocked fetch: URL/headers/body, retry on 429 then success, no
  retry on 401, logs contain no text), factory cases (stub fallbacks, DPA throw). Mirror the
  assertion style of the existing `services/llm` specs (Vitest).
- **Gate:** `cd backend && npx tsc --noEmit && npm test -- src/services/tts && npm run lint`.

### T2 — DB + contract + routes

- `prisma/schema.prisma` Profile block (after `appearance`, ~L58):
  `voice String @default("v1") // 'v1'..'v4' — z.enum in contract/models.ts; registry in TTS_VOICES`
  New migration dir `..._add_profile_voice/migration.sql`:
  `ALTER TABLE "profile" ADD COLUMN "voice" TEXT NOT NULL DEFAULT 'v1';`
  Then `npx prisma generate`. Local DB only — never a shared DB.
- `contract/models.ts`: next to `appearanceSchema`:
  `export const voiceSchema = z.enum(['v1','v2','v3','v4']);` — add `voice: voiceSchema` to
  `profileSchema` AND to `profileDetailSchema`'s settings object. New:
  `export const voicesSchema = z.array(z.object({ id: voiceSchema, label: z.string(), sampleUrl: z.string().nullable() }));`
  `export const speechBatchRequestSchema = z.object({ profileId: z.string().uuid(), texts: z.array(z.string().min(1).max(500)).min(1).max(24) });`
  `export const speechBatchResponseSchema = z.object({ urls: z.array(z.string().nullable()) });`
- `profiles.dto.ts`: `voice: voiceSchema.optional()` in `updateSettingsSchema` (import from
  contract). `createProfileSchema` unchanged. Add the accept/reject/optional spec trio in
  `profiles.dto.spec.ts` mirroring the appearance cases.
- `profiles.service.ts`: add `voice: p.voice` to `view()` and to the settings object in `get()`.
  `updateSettings` spreads the DTO — needs no change; verify by reading it.
- New `modules/speech/` (controller + module, follow any small module's layout):
  - `GET /voices` (family `JwtAuthGuard` — the default guard; response `voicesSchema` via
    `ApiZodResponse`): map `tts.voices` + `sampleUrls()` → `[{id, label, sampleUrl}]`.
  - `POST /speech/batch` (body `speechBatchRequestSchema` via the local `ZodDto` factory —
    `src/common/zod-dto.ts`, NOT nestjs-zod): `assertProfileOwned(profileId, accountId)`
    (`src/common/ownership.ts`) → `tts.urlsFor(texts, profile.voice)` → `{urls}`. HTTP 200.
  - Module imports `TtsModule`; register in `app.module.ts`.
- `exercise.mapper.ts`: change the `audioUrl` mapping to a literal `audioUrl: null` with comment
  `// wire slot dormant — clips resolve via POST /speech/batch; never leak a storage key`.
  (`syllableAudio` stays as is.) Check `exercise.mapper.spec.ts` — update its expectation if it
  asserts passthrough of a non-null audioUrl (it has a `'https://blob/sommer.mp3'` case).
- Contract pipeline: `npm run openapi:export` (backend) → `npm run gen:api` in `frontend/` AND
  `trainer/` → commit `openapi.json` + both `api.gen.ts`.
- **Gate:** backend `tsc && npm test && lint` green; `git diff --stat` shows openapi.json + both
  api.gen.ts regenerated; fixtures + frontend golden snapshots have **zero diff**.

### T3 — LLM-path synthesis (`modules/sessions/sessions.service.ts`)

In `createLlm`, after the insert `$transaction` resolves and BEFORE building the response:
```ts
const texts = created.items.flatMap((i) => [i.payload.prompt, i.payload.answer].filter(isNonEmptyString));
await this.tts.narrateForVoice(texts, this.tts.elevenIdFor(profile.voice)); // never throws
void this.tts.narrateRemainingVoices(texts, this.tts.elevenIdFor(profile.voice));
```
Rationale: the client batch-fetches URLs immediately after session creation, so the student's
current voice must exist synchronously (~1–3 s on top of the LLM wait); the other 3 voices
complete in the background; any failure converges on 404-at-play → silence. `profile` is already
in scope (loaded via `assertProfileOwned`). `sessions.module.ts` imports `TtsModule`. Sessions
specs: add a TtsService mock to the testing module wiring (methods resolve immediately); assert
`narrateForVoice` is awaited with the current voice's elevenId.
**Gate:** `npm test -- src/modules/sessions`.

### T4 — Backfill sweep (`backend/scripts/content-narrate.ts` + npm script)

`"content:narrate": "tsx scripts/content-narrate.ts"` in backend package.json (match how
`content:import` is declared). Script (standalone Prisma client + `createTtsProvider` from env,
mirroring content-import's bootstrapping):
1. Provider stub → print "Narration übersprungen — kein API-Key." → exit 0.
2. Sample pass: for each of the 4 voices ensure the `SAMPLE_TEXT` clip exists (existence-check →
   synthesize gap).
3. Row pass: `item_bank.findMany` (all rows; select payload only). Per row: texts =
   `[payload.prompt, payload.answer]` filtered to non-empty strings (warn+skip a row with no
   prompt). For each of 4 voices × each text: existence-check → synthesize gap.
   (No "narrated" marker anywhere — the sweep is purely existence-check-driven, which is what
   makes partial failures AND voice/model swaps self-heal on every run.)
4. Print totals: rows scanned, clips existing, clips synthesized, clips failed, chars used.
   Never print text content. Exit 0 unless EVERY synthesis attempt failed while live (then 1).
- Extract the pure planning helper `narrationPlanFor(payloads, voices, modelId)` → list of
  `{key, text}` and spec it (placement mirroring the `import-plan` spec).
- `deploy/release.sh`: after the `content:import` invocation, add the same invocation shape for
  `content:narrate` but **fail-soft** (`|| echo "[release] narration failed — silent fallback"`)
  with the TTS env vars in the preserved-env list. Copy the exact sudo/env pattern of the
  import line.
- **Gate:** the plan spec passes; running the script locally with no key → clean skip message,
  exit 0.

### T5 — Frontend

- `src/features/exercises/audio.ts`: DELETE `speak()` + `wordOf()` + all `speechSynthesis` code.
  Add `export function playClip(url: string | null | undefined, soundOn: boolean): void` — no-op
  unless `url && soundOn`; `new Audio(url).play().catch(() => {})` in try/catch.
  `chime`/`buzz`/`fanfare` unchanged.
- New `src/features/exercises/useSpeech.ts`:
  `useSpeech(session, profileId): { urlFor(text): string|null }` — ONE `speechApi.batch(profileId,
  texts)` per session id (texts = each item's prompt + answer, deduped, capped 24), stores a
  `Map<text,url>` in a ref; failures → empty map (all silent). Optionally warm the next item's
  clip on index change.
- New `src/features/exercises/usePromptAudio.ts`:
  `usePromptAudio(ex, soundOn, urlFor): { play(): void; plays: number }` — `useEffect` keyed on
  `ex.id` autoplays `playClip(urlFor(ex.prompt), soundOn)`; `play()` replays + increments a local
  ref counter (future telemetry seam — do NOT send it anywhere).
- `LessonRunner.tsx`: mount `useSpeech` + `usePromptAudio`; speaker/replay icon button (lucide
  `Volume2`, aria-label "Aufgabe vorlesen") in the row with `ProgressBar`, hidden when
  `!soundOn || !urlFor(ex.prompt)`. In `useAnswer.ts` replace the `speak(ex, soundOn)` call with
  `playClip(answerUrl, soundOn)`, threading `answerUrl` from `SingleChoiceExercise` props the same
  way `soundOn` is threaded today; keep the change minimal and typed.
- `/profil` (`app/tabs/Profil.tsx`): new card **between the Ton row and the Aussehen card**,
  header "Stimme". Bespoke `VoicePicker` (do **NOT** use `RadioRow` — its arrow-key handler fires
  onChange per keystroke → would PATCH+preview on every arrow press): `role="radiogroup"` of 4
  rows, each `role="radio"` + `aria-checked`, label left, small speaker preview button right
  (aria-label "Stimme anhören", `playClip(sampleUrl, true)` — explicit gesture, deliberately not
  gated on soundOn), selected ring via existing token classes (no hardcoded colors — night mode).
  Data from new `useVoices()` query (`['voices']`, `coreApi.voices()`); hide preview buttons
  while loading or when `sampleUrl` null. Selection → `settings.mutate({ voice: id })` (shared
  error alert covers failures). After voices load, preload the 4 samples
  (`new Audio(url).preload = 'auto'`).
- `lib/endpoints.ts`: `coreApi.voices()`, `speechApi.batch(profileId, texts)`.
  `lib/types.ts`: `export type Voice = Profile['voice'];` + response aliases.
- Spec updates: profile literals gain `voice: 'v1'` in `Profil.spec.tsx`, `Erfolge.spec.tsx`,
  `Lernen.spec.tsx`, `a11y.spec.tsx`, `LessonRunner.spec.tsx`. New specs: `audio.spec.ts`
  (playClip null/soundOn guards; assert the module contains no `speechSynthesis`),
  `useSpeech.spec.ts` (one batch call per session, urlFor hit/miss, failure → all-null),
  `usePromptAudio.spec.ts` (autoplay once per ex.id, replay increments), Profil picker spec
  (mock voices query; click radio → `updateSettings` called with `{voice:'v2'}` — mirror the
  existing picker test ~L123). `LessonRunner.spec.tsx`: mock `speechApi.batch`.
- **Gate:** `cd frontend && npx tsc -b && npm test && npm run lint`;
  `grep -rn "speechSynthesis\|SpeechSynthesisUtterance" src/` → empty;
  `git diff --exit-code src/features/exercises/__snapshots__` (goldens unchanged).

### T6 — Infra + env example (edit only these files; do NOT run terraform)

- `infra/cdn.tf`: in `local.csp`, after the `img-src` entry, add
  `"media-src 'self' https://${local.blob_bucket}.s3.${var.region}.amazonaws.com",` mirroring the
  img-src line's interpolation exactly (verify the local/var names used there).
- `infra/iam.tf`: new statement in the instance policy document: sid `AudioObjects`, actions
  `["s3:GetObject","s3:PutObject"]`, resources `["${aws_s3_bucket.blob.arn}/audio/*"]`.
- `infra/ssm.tf`: `ELEVENLABS_API_KEY` added to the secrets map (same placeholder pattern as the
  other secrets); `TTS_VOICES`, `TTS_MODEL_ID`, `TTS_DPA_ACK`, `TTS_CHARS_PER_DAY` to the config
  map (real values — SSM rejects empty strings: model `eleven_multilingual_v2`, ack `true`,
  chars `200000`, voices a valid 4-entry JSON with obviously-placeholder elevenIds).
- `backend/.env.example`: new TTS block after the LLM block, commented (stub-when-blank note,
  mirroring the LLM block's style).

### T7 — Docs (same PR — repo rule: docs must stay true)

- `backend/SPEC.md` §9: full rewrite — un-defer; registry/`TTS_VOICES`, key scheme, /speech
  lookup-only + blind presign, sweep self-healing (existence-check everything, no marker),
  append-only cache + old-voice retention + zero-silence swap runbook, praise-not-narrated note.
  Also: §3 profile DDL gains `voice`; §6 gains `GET /voices` + `POST /speech/batch` + settings
  `voice?`; the L25 stack line's TTS mention; §11 env list gains the 6 vars.
- `frontend/SPEC.md`: §5 rewrite (Web Speech REMOVED; batch prefetch via /speech; autoplay +
  replay button; answer readback; missing clip → silence + chime); §6 settings list + §2 screen
  map gain the Stimme entry.
- `ARCHITECTURE.md`: system-diagram TTS footnote (~L27) Polly → ElevenLabs; the DPA-discipline
  paragraph (~L552): ElevenLabs DPA + only exercise text leaves + `TTS_DPA_ACK` gate.
- `ROADMAP.md`: deferred-list TTS entry → shipped (move detail to `HISTORY.md` per repo
  convention); spoken-praise quick-win line references the new pipeline.
- `docs/tts-narration-plan.md`: header → ACTIVATED/superseded, pointer to backend SPEC §9.
- `docs/mobile-roadmap.md`: on-device-TTS paragraph gets a superseded note (clips are the answer
  on all platforms; iOS audio-session gotcha still applies).
- `HISTORY.md`: entry per its format. `backend/README.md` capability table TTS row.

### T8 — Final verification + PR

1. All three projects: `lint · tsc · test · build` green.
2. `openapi.json` diff contains exactly: profile `voice`, `/voices`, `/speech/batch`.
3. `git diff --exit-code` on fixtures + frontend golden snapshots (must be clean).
4. e2e: not in CI; if run locally, expect green with zero changes (stub → all-null URLs →
   silence).
5. Optional dev smoke (needs a real key + `TTS_VOICES` in backend/.env): `content:narrate` →
   4 samples + 8 clips per item in the local store; `/voices` returns labeled entries; a session:
   prompt autoplays, replay works, answer readback on correct; Stimme picker previews + switches.
6. PR to `main` from `feat/tts-voices`; PR body includes the Operator runbook below. Do not
   merge.

## Operator runbook (Flo — not the implementer)

1. Pick 4 voices on elevenlabs.io (German; clear-speech: slower rate, wider pitch range; e.g.
   "Warm & ruhig", "Hell & munter", "Tief & gemütlich", "Klar & flott"); fixed-fee tier
   (Creator $22 first month recommended); check the ElevenLabs DPA.
2. `terraform apply` (expect: CSP media-src, IAM AudioObjects, SSM params), then set the real
   `ELEVENLABS_API_KEY` + `TTS_VOICES` values in SSM.
3. Merge + deploy (release runs migrate → seed → content:import → content:narrate fail-soft).
4. Smoke: narrate journal counts + rerun no-ops; session audio autoplay/replay/readback; no CSP
   violations; Stimme picker previews 4 distinct voices; switch voice → next session speaks it;
   fresh ✨ lecture audible immediately; old-voice clips still in S3 after any swap.
5. **Zero-silence voice swap:** run `content:narrate` on the box with the NEW `TTS_VOICES`
   exported first, THEN update SSM + restart. In-flight sessions keep playing old-voice URLs
   (append-only cache guarantees they exist); presigned URLs start working the instant a clip
   appears.

## First-run volume (expectation-setting)

Repo content today: 12 exercises (2 lectures) → 23 unique strings + 1 sample = 24 × 4 voices =
**96 clips, ~2k chars**. Plus 8 clips per LLM item already in the prod bank (unknown count,
bounded by the 3-sessions/day cap). §F content later flows through the same sweep automatically —
nothing special needed.
