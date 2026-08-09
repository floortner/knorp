# TTS narration — provider decision + implementation plan

**Status: PARKED 2026-08-09 (decided, not built).** Provider direction is settled — **ElevenLabs**
replaces the old "target Amazon Polly" note — but implementation deliberately waits for §F: the
training types and lectures have to exist before we know **where** narration is needed (which
exercise types, which texts) and **which voices** fit. Pick this plan up when §F content lands;
the voice itself gets chosen with Angelika by ear (see "Human step"). ARCHITECTURE/SPEC still say
"Polly, deferred" — they get rewritten in the build PR per the docs step below, not before.

## Decision record (2026-08-09)

- **Provider: ElevenLabs** (multilingual v2/v3). Best German MOS in 2026 comparisons, and — the
  deciding factor — **Voice Design**: bespoke character voices from a text prompt, which is the only
  realistic path to distinct buddy/monster voices without hiring voice actors. Fixed-fee tiers
  (Starter $6 / Creator $22 ≈ 30k/121k chars/mo) cap spend; narration is synthesize-once-and-cache,
  so volume is small and quality wins over per-char price.
  - Runners-up: **Azure AI Speech** (14+ de-DE neural voices incl. Gisela, a real child voice;
    ~$16/1M chars; "assistant-grade", weak character personality) — the budget fallback if
    ElevenLabs disappoints in the bake-off. **Amazon Polly** (no new vendor, IAM-native, but only
    ~3 de-DE generative voices, region-patchy, no character fit). **OpenAI TTS** rejected
    (voices optimized for English; German accent issues).
- **Scope: all exercise content** — pre-generated for imported/bank items, fire-and-forget for
  LLM-generated items (both land in `item_bank`, so every text is synthesized once and cached).
  Chat narration: no. Spoken praise: later, needs a fixed praise pool (ROADMAP §D quick-win 8).
- **Voice cast: single narrator first**; the cache key namespaces by voice from day one so
  per-buddy voices later are purely additive.
- Web Speech API stays as the permanent silent fallback (`audioUrl: null` or playback error).

## Codebase facts the plan builds on (verified 2026-08-09)

- The slots already exist end-to-end and are always null: wire `audioUrl`
  (`backend/src/contract/exercise.ts:14-21`, dormant `syllableAudio` too), DB `item_bank.audio_url`
  (`prisma/schema.prisma:86`), mapper `exercise.mapper.ts` (`item.audioUrl ?? null`). **No contract
  change, no golden/openapi diff.**
- Null producers to hook: LLM path `sessions.service.ts:249`, importer `scripts/content-import.ts:48`,
  `lecture-file.schema.ts:81`. The importer is content-addressed with `update: {}` — narration must
  be a **separate idempotent backfill pass**, not part of the import upsert.
- Provider pattern to mirror: `services/llm/` (`anthropic.provider.ts` + `stub.provider.ts`,
  factory with prod DPA-ack gate). No TTS service exists today.
- Storage: `keyFor()` forces `users/{account}/{profile}/` — a shared `audio/` namespace is new.
  The stable-presign mechanism (`signedHomeworkReadUrl(key, ttl, {stable})`) is directly reusable.
- **Two infra blockers:** CSP has **no `media-src`** (`infra/cdn.tf:20-33` — `new Audio(s3Url)` is
  blocked today), and instance-role S3 object ops are scoped to `${blob.arn}/users/*`
  (`infra/iam.tf:24-40`). Blob lifecycle expiry is tag-scoped `class=homework` — untagged audio
  objects are safe/permanent.
- Frontend: `audio.ts#speak` conflates prompt/answer — it plays `audioUrl` if set, else Web-Speaks
  `ex.answer`, and fires only on a **correct answer** (`useAnswer.ts:29`). Narrating the prompt
  requires splitting this (see Step 5) — today's behavior is preserved because `audioUrl` is null.

## Implementation (when picked up)

### 1. Backend `src/services/tts/` (mirror `services/llm/`)
- `tts.types.ts`: `TtsProvider` (`name`, `live`, `voiceId`, `modelId`, `synthesize(text): Promise<Buffer>`),
  DI symbol `TTS_PROVIDER`.
- `elevenlabs.provider.ts`: native fetch,
  `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128`,
  header `xi-api-key`, body `{text, model_id}` (default `eleven_multilingual_v2`). One retry on
  429/5xx (~1s backoff); 401/422 throw immediately as `ApiException(503, 'PROVIDER_UNAVAILABLE')`
  (the reserved envelope code). Log char counts + status only — **never the text** (rule 6).
- `stub.provider.ts`: `live=false`; dev/e2e stay offline and deterministic.
- `tts.service.ts`:
  - `audioKeyFor(text, voiceId, modelId)` — exported pure:
    `audio/tts/{voiceId}/{modelId}/{sha256(text).slice(0,40)}.mp3`. Voice+model as path segments
    from day one → per-buddy voices later are sibling objects, zero invalidation.
  - `ensureNarration(text): Promise<string|null>` — stub/kill-switch/budget → null; object exists →
    key (dedup, idempotency); else synthesize → `writeSharedBinary` (`audio/mpeg`, **no S3 tags**,
    so the homework lifecycle rule never sweeps it) → key. Errors → null. **Never throws.**
  - Guardrails: in-memory daily counter vs `TTS_CHARS_PER_DAY` (default 50k), `TTS_DISABLED`
    kill switch; fixed-fee ElevenLabs tier caps provider-side spend.
- `tts.module.ts`: pure `createTtsProvider` — no key or no voice id → stub (+warn); prod key without
  `TTS_DPA_ACK=true` → boot throw (same DPA gate as LLM; ARCHITECTURE §8 — only exercise text ever
  leaves, never student data).
- `storage.service.ts`: add `writeSharedBinary`/`sharedObjectExists` (bypass `keyFor`, which stays
  untouched); generalize stable presign as `signedReadUrl(key, ttl, opts)`, keep
  `signedHomeworkReadUrl` as a delegate. Dev FS route (`storage.controller.ts`): content type by
  extension (`.mp3` → `audio/mpeg`).

### 2. Serve-time presign
`toExercise` stays sync/pure. New `presignAudio(items, storage)` maps stored keys → stable presigned
URLs (1h stable window, browser-cacheable — same as chat homework images). Update the 4 call sites:
`sessions.service.ts:156,272,323`, `staff/lectures.service.ts:89`; add `StorageModule` imports.
(Chosen over a same-origin proxy: presigning already solved caching + auth for images; a proxy
would route every audio byte through the one small instance.)

### 3. Synthesis triggers
- **Backfill** `scripts/content-narrate.ts` + `npm run content:narrate`: rows
  `WHERE audio_url IS NULL`, narrate `payload.prompt` (skip+warn if absent), update the key.
  Idempotent; doubles as the retry sweep for failed LLM-path synths. Wire into `deploy/release.sh`
  after `content:import`, **fail-soft** (narration failure never blocks a release). Exit 0 when
  provider is stub.
- **LLM path** (`createLlm`): `void narrateItems(created.items)` fire-and-forget **after the
  transaction commits** — the student is already waiting on the LLM round-trip; first play falls
  back to Web Speech, later servings hit the cached mp3. Bounded by `LLM_SESSIONS_PER_DAY`.
- **Failure semantics:** everything converges on `audio_url = null` → silent Web Speech fallback.

### 4. Env + infra
- `env.ts` (replaces the "TTS_* removed" comment): `ELEVENLABS_API_KEY`, `TTS_VOICE_ID`,
  `TTS_MODEL_ID` (default `eleven_multilingual_v2`), `TTS_DPA_ACK`, `TTS_CHARS_PER_DAY=50000`,
  `TTS_DISABLED`; mirror in `.env.example`.
- `infra/ssm.tf`: key in `ssm_secrets` (value out-of-band); voice/model/ack/budget in `ssm_config`.
- `infra/cdn.tf`: add `media-src 'self' https://{blob_bucket}.s3.{region}.amazonaws.com`.
- `infra/iam.tf`: statement `s3:GetObject,PutObject` on `{blob.arn}/audio/*`.

### 5. Frontend (minimal)
- Split `audio.ts#speak`: `speakAnswer(ex, soundOn)` (correct-answer feedback — Web Speech of
  `ex.answer` only; `useAnswer.ts:29` renames, behavior identical today) and `playPrompt(ex, soundOn)`
  (`audioUrl` → `new Audio` with error-fallback to Web Speech of `ex.prompt`).
- `usePromptAudio(ex, soundOn)` hook returning `{play, plays}` — local counter, the seam J5.2's
  `audio_plays` attaches to later (not sent yet).
- Speaker/replay button next to the prompt (hidden when `!soundOn`); auto-play on item mount keyed
  on `ex.id`, `.catch`-silent if a mobile browser blocks the first autoplay (button is the
  recovery — SPEC §5 gesture gating honored).
- Frontend render snapshots regenerate deliberately; backend goldens + `openapi.json` zero-diff.

### 6. Human step (with Angelika, by ear)
Pick the narrator on elevenlabs.io — library voice or Voice Design ("warme deutsche Vorleserin,
langsam, freundlich"; clear-speech parameters per `content/academia`: markedly slower rate, wider
pitch range, not just low rate) — then set `TTS_VOICE_ID` in SSM. Optional bake-off: same 5–10
sample lines on ElevenLabs vs Azure before committing. Fixed-fee tier on Flo's account; DPA check.

### 7. Tests
`tts.service.spec.ts` (key determinism/uniqueness, stub short-circuit, existing-object skip,
error→null, budget, kill switch) · `elevenlabs.provider.spec.ts` (mocked fetch: request shape,
retry matrix, no text in logs) · factory spec (stub/DPA cases) · mapper `presignAudio` spec ·
narrate-script row selection as a pure function spec. e2e unchanged and green with no key.

### 8. Docs (same PR)
backend SPEC §9 un-defer + rewrite · SPEC L25/L598 mentions · ARCHITECTURE diagram L27 + DPA L552
(Polly → ElevenLabs) · ROADMAP deferred list + spoken-praise line · frontend SPEC §5 (audioUrl =
**prompt** narration, replay affordance) · backend README capability table · `.env.example` ·
HISTORY.md entry.

### Phasing
**PR 1 (all of the above) lands dormant:** no key + no content → stub provider, null `audioUrl`,
Web Speech — exactly today's behavior; the moment §F content imports and the key is set, the deploy
narrates the bank automatically. **Later:** per-buddy voice map (`TTS_VOICE_MAP`, read-time key
selection via `audioKeyFor`, stored default-voice key as fallback), J5.2 `audio_plays`,
spoken-praise pool, `syllableAudio`, mobile on-device TTS (separate seam, `docs/mobile-roadmap.md`).

### Verification (build PR checklist)
1. Backend `lint`/`test` green; goldens + `openapi:export` zero-diff.
2. Dev smoke with real key: `content:narrate` sets `audio_url`; session returns a playable URL;
   re-run → all no-ops.
3. Frontend tests with regenerated snapshots; manual: auto-play, replay, `soundOn=false` mutes,
   null/broken URL → Web Speech.
4. e2e green untouched (stub).
5. `terraform plan` shows exactly: CSP media-src, IAM audio statement, SSM params. Post-deploy:
   no CSP violation, replay hits browser cache, journal shows char counts only.
6. `TTS_DISABLED=true` → null audioUrl, zero provider traffic.
