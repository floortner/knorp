# ROADMAP.md

**Single source of truth** for build milestones (what's shipped) and the forward plan (what's next) across
*besserlesenschreiben* — backend (`-api`), frontend (`-web`), reviewer (`-review`) — and the top-level
`e2e/` suite.

This file replaces the former per-spec milestone sections (`backend/SPEC.md §12`, `frontend/SPEC.md §11`)
and the old `saved-plan.md`. **When a milestone ships, tick it here** — not in the specs. The specs describe
*what the system is*; this file tracks *what has been built and what's left*.

## Status at a glance

Everything through **Phase 2.5 + the Post-2.5 work** below is **DONE** and CI-green. The whole forward plan's
hardening (A), cleanup (B), most engagement work (C1, D1–D4, D7), and the **E — beta on AWS** milestone
have shipped: backend + family frontend + reviewer portal are live on real HTTPS domains (`infra/` Terraform
+ `deploy/` on-box scripts + `.github/workflows/deploy.yml`), inside the €50/mo all-in budget.

- **Next:** **D5 / D6** (badges, weekly parent email) — self-contained engagement work.
- **Opportunistic:** **C2** (a concrete new exercise type), whenever the content work calls for it.
- **Deferred:** billing (app is free; access gated by staff approval — ARCHITECTURE §1b/§9; schema kept
  dormant) · TTS pipeline (Web-Speech fallback on the client for now; target Amazon Polly) · full-prod
  hardening (multi-instance/ALB, managed RDS + DR, OTel collector, staff MFA — see §E "Deferred to full
  production").

---

## Shipped (DONE)

### Backend / cross-cutting

**Phase 1 — free tier:**
1. ✅ Auth (email code + JWT, httpOnly cookie + logout), account/profile, settings, parent PIN.
2. ✅ Item bank: unique `seed_key` column, load `item_bank.seed.json` via `prisma/seed.ts` (`npm run seed`).
3. ✅ Sessions (bank) + attempts ingest + progress + FSRS.
4. ✅ Digest generation.

**Phase 1.5 — hardening:** runtime response-contract validation (`ZodResponseInterceptor`); httpOnly cookie
auth + `/me`-probe frontend; durable PIN lockout (`pin_attempts`/`pin_locked_until`); prod email (Resend) +
object-storage adapters (fail-loud, no silent no-op); 201 statuses on creating POSTs; FSRS `learning_steps`
persistence; React error boundary + renderer safety; offline session caching + telemetry retention;
guard/flow tests; the docs.

**Phase 1.6 — content + UX polish:** auto-unlock next unit on session complete (atomic, backend);
all-units-complete celebration (pixel mascot, fanfare, confetti); 5 new exercise types (`swipe`, `odd`,
`listen`, `sentence`, `build` — Zod contract + renderers + seed items); parent area (PIN gate, set-PIN, child
progress, two-step reset); profile Ton toggle wired end-to-end (removed Legasthenie-Schrift + Schriftgröße
stubs).

**Phase 1.6 technical debt — RESOLVED:**
- ✅ Parent-scoped child id no longer comes from the request body: `verify-pin` binds the target `profileId`
  into the `parentToken` JWT (ownership validated at issue); `reset`/`unlock-next` read it via
  `@ParentProfileId()`. Destructive routes take no body id.
- ✅ `apiFetch` takes a per-request `token`; the global `setAuthToken` mutation is gone.
- ✅ `sessionCompleteSchema` includes `allUnitsComplete: boolean` (backend authoritative; no hardcoded
  `TOTAL_UNITS`).
- ✅ Unsafe `as ApiError` casts replaced by an `isApiError` guard + `errorMessage()` helper.

**Phase 2 — free AI features + approval-gated access (★):**
> Product decision: the app is **free, including AI**. No billing/`EntitlementGuard`/credit enforcement —
> `★` means "AI-backed / cost-bearing op," free for any **approved, active** account. The
> `entitlement`/`credits_ledger`/`processed_webhook` tables stay **dormant** (metering addable later without a
> migration — ARCHITECTURE §9). Access control lives in the **account lifecycle** (ARCHITECTURE §1b), driven
> from the staff portal.
5. ✅ **`LlmService`** — abstracted; Anthropic-direct dev default; structured output via a forced tool whose
   `input_schema` is the JSON Schema of the caller's `src/contract` Zod schema, re-validated (incl. per-type
   **solvability**) with a one-shot re-ask on a contract miss; EU-residency gate before prod; canned/stub
   path when `ANTHROPIC_API_KEY` is unset. Model policy: `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
   (generation/chat), `ANTHROPIC_VISION_MODEL` = `claude-opus-4-8` (homework OCR); no `temperature`/`top_p`/
   `top_k` (rejected on current models — steer via prompt); stable system prompts sent as cacheable blocks.
6. ✅ **Chat** (free ★).
7. ✅ **Homework upload + vision draft (family side).** `POST /homework` → storage (EXIF strip, WebP) → Claude
   vision → `llm_analysis` draft, `status='pending_review'`, enqueued for the staff review queue. **Nothing
   mutates the profile** until a reviewer approves.
8. ✅ **LLM session generation** — folds a reviewed upload's `reviewed_analysis.suggestedFocus` into the next
   on-the-fly lecture; generated exercises validated for solvability, stamped with a grade-band difficulty.

**Phase 2 access-control — approval-gated signup + staff user-admin (ARCHITECTURE §1b):**
9. ✅ **Account lifecycle.** `account.status` (`pending|active|deactivated`) + migration; silent
   pending-on-first-code (no email until approved); family `JwtAuthGuard` requires `status='active'`
   (immediate deactivate/delete).
10. ✅ **Staff user administration (admin role only).** `GET /staff/users`, approve / deactivate / delete
    (erases DB + blobs) — distinct from the pseudonymised reviewer queue; reviewer-portal admin screens.

~~Billing (entitlements, credits, webhook, pay-it-forward)~~ — **removed from the roadmap** (schema kept
dormant; ARCHITECTURE §9).

**Phase 2.5 — professional review + staff portal:** the entire staff realm and the `-review` portal;
reviewed homework now shapes lectures.
11. ✅ **Staff realm foundation.** `reviewer` + `homework_review` tables; `StaffAuthGuard` (`aud:"staff"`,
    disjoint `STAFF_JWT_SECRET`, rejected on family routes and vice-versa); staff login (email code, own
    httpOnly cookie) + `GET /staff/me`; ~3 reviewers admin-seeded (no self-signup).
12. ✅ **Review queue + authoritative apply.** `GET /staff/queue` (pseudonymised, cursor-paged, per-upload
    short-lived presigned `imageUrl`); claim/lease (`409` if held); `POST /staff/reviews/{id}` writes
    `reviewed_analysis`, derives `attempt` rows + adjusts `review_state`, sets `status='reviewed'`, records
    the LLM-vs-reviewer diff (`agreed_with_llm`).
13. ✅ **Lecture wiring + family status.** `reviewed_analysis.suggestedFocus` folds into the next lecture;
    `-web` surfaces `pending_review → reviewed` + the read-only authoritative result (no confirm UI).
14. ✅ **Reviewer portal** (`besserlesenschreiben/reviewer`) — thin client over `/staff/*`, desktop/tablet
    landscape: shell + staff auth; pseudonymised queue screen + claim; two-pane review screen
    (approve / correct / reject) → `POST /staff/reviews/{id}`.

**Post-2.5:**
- ✅ **Lexeme foundation** — `lexeme` table (2,127-word base from the Rechtschreibwortschatz 2015 extraction),
  committed `lexeme.seed.json` ⊕ `lexeme.overrides.json` change-set (corrections survive reseeds), reviewer
  **Wortschatz** curation tab (full-property filters + aggregate stats + full-column editor), `familyStem` +
  `compoundParts` structure, `npm run gen:items` (solvability-gated exercise candidates for human review).
- ✅ **Reviewer portal expansion** — brand-aligned chrome, nav count badges, queue history (`Offen/Erledigt/
  Alle`), admin-only learner-progress views (identity-bearing per account; pseudonymised per upload).
- ✅ **Homework-in-chat** — upload moved into the family Chat tab; durable photo + status bubbles served by
  chat history; verdict echoed in-chat.
- ✅ **E2E harness** — top-level `e2e/` Playwright suite (backend + frontends via `webServer`, capture email
  provider, seeded dev accounts via `SEED_DEV_ACCOUNTS`). Run **locally only** (`cd e2e && npm test`) —
  intentionally not in CI.
- ✅ **AWS retarget** — S3 storage adapter (presigned URLs), Frankfurt region docs; deployment still pending.
- ✅ **Lexeme `age_band`** — per-word target band (`6-7` | `8-9` | null), reviewer Wortschatz filter/column/
  stat + editor, threaded into lecture word-pool selection (`gradeBand` → `wordPoolFor`) as a null-tolerant
  age ∩ frequency intersection (unbanded words stay eligible). Band-aware `gen:items` deferred until curation
  populates the facet.

### Frontend (`-web`)

**Phase 1:**
1. ✅ App shell, routing, tab nav, API client, auth (email-code + code-entry; cookie session + `/me` probe).
2. ✅ Onboarding (buddy + goal) → `POST /profiles`.
3. ✅ `/lernen` home + unit cards + session fetch.
4. ✅ **Telemetry plumbing** (`lib/telemetry.ts`): fire-and-forget `POST /attempts` with a real `timeMs`,
   offline queue + retry (48h retention/size cap).
5. ✅ **The exercise renderers** — each emits exactly one attempt through the milestone-4 pipeline.
6. ✅ Progress (`/profil`, `/liga`→`/erfolge`) + voice + accessibility settings.

**Phase 1.5:** error boundary + renderer safety; offline session caching (PWA runtime caching); query
correctness fixes; committed `api.gen.ts` + drift gate; flow tests.

**Phase 1.6:** auto-unlock next unit; all-units-complete celebration; parent area; profile Ton toggle.

**Phase 2:** Chat (★) + the ✨ generated-lecture entry on `/lernen` with the intro card; homework
"Foto & verbessern" upload (moved into the **Chat tab** — photo as a chat message; no confirm UI; the staff
portal owns review). No billing UI — the app is free.

**Vokaltraining pivot:** the exercise set was replaced with the owner's program — the **14 types**
(Wortraster, Selbstlaute, kurz/lang, Quatschwörter, Komposita, Wortfamilien), a 7-unit progression with
per-unit Merksatz intro cards, and a ~360-item seed bank extracted from the program docs.

> The **staff reviewer portal** is a **separate subproject** (`besserlesenschreiben/reviewer`, future
> `-review` repo), out of scope for `-web`: don't build review/queue screens there. The only homework surface
> in `-web` is the upload + status tracking in the Chat tab.

---

## Forward plan

### A. Hardening & best practices — DONE

1. ~~No request-level rate limiting.~~ **DONE** — `@fastify/rate-limit` in `main.ts`: 10 req/min for
   `/auth/*`, 300/min elsewhere, loopback exempt for e2e (PR #49 + allowList fix).
2. ~~E2E coverage misses the upload → reviewer verdict → chat-status seam.~~ **DONE** —
   `homework-loop.spec.ts` cross-realm Playwright journey (PR #50).

> The remaining pre-prod hardening — observability, off-platform backups, staff-MFA decision — is
> deploy-coupled and lives in **section E** so it ships as one milestone.

### B. Remove / simplify — DONE

1. ~~Delete `scripts/build-seed.ts`~~ **DONE** (PR #49) — it regenerated `item_bank.seed.json` from the legacy
   prototype's 12-type LESSONS; one run would wipe the curated bank. Removed, with its ARCHITECTURE/CLAUDE refs.
2. ~~Drop `TTS_PROVIDER`/`TTS_KEY` and `BILLING_PROVIDER`/`BILLING_WEBHOOK_SECRET`~~ **DONE** (PR #49) — dead
   env, wrong for the AWS design (Polly authenticates via IAM role; billing re-adds by migration if ever needed).
3. ~~Expired login-code rows accumulate (`login_code`, `staff_login_code`).~~ **DONE** (PR #49) — cleanup
   exists; scheduling it folds into E5.
4. ~~Reviewer claim isn't released on leaving the review screen (lease expires after 15 min).~~ **DONE** (PR #49).

### C. Extensibility

1. ~~Age property (`ageBand` on lexeme).~~ **DONE** — `ageBand ∈ {"6-7","8-9",null}` end-to-end (migration
   `add_lexeme_age_band` + `@@index`; `lexemeSchema` + `byAgeBand` stat; overrides/seed/`toWire`/filters;
   reviewer Wortschatz filter + column + editor; artifacts re-exported). Selection: `gradeBand()` (≤unit 4 →
   `6-7`, else `8-9`) → `wordPoolFor`/`pickForSkill` with a **null-tolerant** `age_band IS NULL OR =band`
   (unbanded words stay eligible while curation is sparse).
   - **Deferred follow-ups:** band-aware `gen:items` (waits until words are actually banded); the profile-side
     counterpart (grade or birth year — `unlockedUnit` is a weak age proxy; its own small milestone touching
     profile schema/contract + onboarding UI + `useMe`).

2. **New exercise / test types (open — opportunistic).** Per-type cost is fixed and safe; the drift gates
   catch everything.
   - **Backend:** `src/contract/exercise.ts` (add the Zod variant, extend the `discriminatedUnion`, add a
     `superRefine` case to `solvableExerciseSchema` so it can't emit an unanswerable item) → `exercise.spec.ts`
     (solvability unit test) → `item_bank.seed.json` (hand-curate a batch — no wholesale regeneration) →
     `scripts/gen-items-from-lexemes.ts` (a generator only if the type is lexeme-grounded) →
     `sessions.service.ts` `FEW_SHOT` (only if it should be LLM-generatable). `npm run openapi:export`.
     **Warning:** the union already exceeds strict tool mode's limits — keep the wire schema strict-agnostic,
     leave solvability enforcement post-hoc, don't re-enable strict.
   - **Frontend:** `ExerciseView.tsx` (dispatch case — reuse `SingleChoiceExercise`/`BinaryChoiceExercise`
     where the shape fits, else a new renderer) → `derive.ts` `promptAndExpected()` (telemetry case — stay
     total over the union) → `fixtures/session.example.json` (one golden example so the "one of each type"
     gate stays green) → `ExerciseView.spec.tsx` (snapshot + interaction test). `npm run gen:api`.
   - **Reviewer:** none — exercise types don't surface in the staff portal.

### D. Frontend engagement & retention

Constraint (from the docs and correct for struggling readers): calm feedback, **no lives/energy/dark
patterns**. Ranked by impact-per-effort.

1. ~~Bring the buddy to life.~~ **DONE** — `useBuddyState` hook + `buddyStateSrc`; all 4 states wired to live
   progress data (PR #51).
2. ~~A visible "today" goal.~~ **DONE** — `GoalCard` with SVG ring + activity `WeekStrip`; "Heute geübt ✓"
   (PR #54).
3. ~~Session-end forward hook.~~ **DONE** — forward-hook card with buddy in cool state at `LessonComplete`;
   buddy threaded from `LessonRunner` (PR #54).
4. ~~Kind streaks.~~ **DONE** — flame hidden at 0, warm restart card, weekly Streak-Joker (PRs #52 + #53).

5. **Badges (OPEN).** The SVG policy reserves them and `review_state` already knows mastery: "Silben-Meister",
   7-Tage-Serie, unit badges, shown in `/profil`. Medium effort (small backend addition). Pairs with D7.
6. **Weekly parent email (OPEN — highest leverage for the target audience).** Retention at this age runs
   through the parent. `digest.md` already computes everything — a Friday "Mia hat 3× geübt, stark bei Silben,
   als Nächstes: Dehnungs-h" via the existing email service turns parents into the reminder system, without
   pushing notifications at a child.
7. ~~Rename `/liga` → "Erfolge".~~ **DONE** — route, tab, heading, tier labels updated (PR #52).
8. **Spoken praise variety (later — needs Polly).** Audio reward beats visual for pre-readers.

> Deliberately **not** recommended: push notifications to the child, real leaderboards, time pressure, loss
> mechanics — antagonistic to a remedial-literacy audience and to the stated values.

### E. First feedback round (beta) on AWS — DONE

**Goal:** get backend + family frontend + reviewer portal running in AWS on real HTTPS domains so **~10
families and 1–2 reviewers** can give a first round of feedback. A beta soft-launch, not full prod
hardening — but with a minimum data-safety floor, because it handles minors' data.

**Budget: €50/mo total, AWS + Anthropic combined** (≈ $54 total — *not* a separate Anthropic figure).
The AWS floor is ~€15–16/mo, leaving **~€34/mo for Anthropic**. This drives every decision below: no ALB
(~€17/mo — a single box needs neither its load-balancing nor its health checks; nginx+LE gives the same
TLS for ~€0), no managed RDS (~€15/mo — self-host Postgres on the box instead), single region, no DR-region
copy. Frankfurt (eu-central-1); hosting per ARCHITECTURE §7 (small EC2 + systemd, no container).

**Architecture:** one **EC2 `t4g.small`** (2 vCPU / 2 GB) running `node dist/main.js` under systemd,
**self-hosted Postgres on the same box**, **nginx + Let's Encrypt** terminating TLS for `api.<domain>`, and
an **S3 blob bucket** (homework/sessions/digests) reached via the **IAM instance role**. The two frontends
are **S3 + CloudFront** (`app.` / `review.`), ACM certs in **us-east-1**. All three are subdomains of one
Route-53 domain the owner already holds, so the `SameSite=Lax` login cookie flows `app.`↔`api.` /
`review.`↔`api.`. Secrets in **SSM Parameter Store** (SecureString), rendered to a root-only systemd
`EnvironmentFile` at deploy. Deploys run from **GitHub Actions via OIDC → a scoped IAM role** (no static AWS
keys) — an `api` job triggers the on-box release through **SSM Run Command** (no SSH / no inbound 22), a
`web` job builds + `s3 sync` + invalidates CloudFront.

Provisioned as **Terraform in `infra/`** (reproducible, reviewable, doubles as the DR rebuild path).

**Round-1 checklist — all DONE:**
1. ✅ **Terraform infra** (`infra/`) — EC2 `t4g.small` + Elastic IP + security groups (443 open; no inbound
   22 — SSM deploys; 5432 never exposed) + EBS data volume; IAM instance role (blob-bucket prefix + SSM
   param read + SSM managed instance); **GitHub OIDC provider + scoped deploy role** (`s3 sync`, CloudFront
   invalidation, `ssm:SendCommand`); one blob bucket (lifecycle on `users/*/homework/`) + two private web
   buckets (OAC); two CloudFront distributions (hashed assets immutable 1y, `index.html`/SW `no-cache`);
   ACM cert in **us-east-1**; Route 53 records (`app.`/`review.`→CloudFront, `api.`→EIP) + SES DKIM/MAIL
   FROM (Terraform-managed); SSM SecureString params (`JWT_SECRET`, `STAFF_JWT_SECRET`, `DATABASE_URL`,
   `EMAIL_KEY`, `ANTHROPIC_API_KEY`); an **AWS Budgets** alert (~€40) + hard spend-cap auto-stop.
2. ✅ **Box bootstrap + service** (`infra/cloud-init.sh.tftpl`, `deploy/`) — cloud-init installs Node 24,
   Postgres, nginx, certbot; local Postgres role/db; `blsb-api.service` systemd unit with the SSM-rendered
   `EnvironmentFile` (incl. `GIT_COMMIT`); nginx reverse-proxy `api.<domain>` :443→:3000 + certbot renew
   timer; built on the Graviton box (Prisma has no `binaryTargets`) to avoid an arm64 engine mismatch.
3. ✅ **GitHub Actions deploy** (`.github/workflows/deploy.yml`, manual `workflow_dispatch` button only —
   merging never auto-deploys) — `api` job: `aws ssm send-command` → on-box `deploy/release.sh` (`npm ci` →
   build → `prisma migrate deploy` pre-traffic → `npm run seed` → refresh env from SSM → `systemctl
   restart`); `web` job: build family + reviewer with prod `VITE_API_BASE` (+ `VITE_PWA=true` for `-web`) →
   `s3 sync` → CloudFront invalidation. Contract drift gates stay green before any deploy.
4. ✅ **Prod config** (`infra/ssm.tf`) — `WEB_ORIGIN`/`REVIEWER_ORIGIN`/`PUBLIC_API_URL`,
   `STAFF_ADMIN_EMAILS`, `EMAIL_PROVIDER=ses` (IAM-role auth, no key), `AWS_S3_BUCKET` +
   `AWS_REGION=eu-central-1`, `LLM_RESIDENCY_ACK=true`, lowered daily caps for beta
   (`LLM_SESSIONS_PER_DAY=3`, `CHAT_MESSAGES_PER_DAY=20`), `SEED_DEV_ACCOUNTS` blank, plus a hard monthly
   spend limit set in the Anthropic console.
5. ✅ **Off-platform backup** (`deploy/backup.sh`, `blsb-backup.service`/`.timer`) — daily `pg_dump` →
   `age`-encrypt (key held outside AWS/SSM) → push to a non-AWS remote (Cloudflare R2 / Backblaze B2) via
   `rclone`; 7-daily + 4-weekly retention. Expired login-code cleanup (B3) folded into the same cron.
6. ✅ **Full ★ AI on, watched** — chat + LLM lessons + Opus homework-vision enabled; low caps + AWS Budgets
   alert + Anthropic spend limit keep run-rate inside €50/mo.

**Observability for beta:** **OpenTelemetry** is the chosen approach (instrument to emit request traces),
but the collector/exporter build-out is **deferred** — round 1 ships only a free uptime ping on
`/api/v1/health`. (Sentry is dropped in favour of OTel.)

**Deferred to full production** (documented, not built now): multi-instance + **ALB**/blue-green · managed
**RDS** + cross-region DR snapshot copy · **OpenTelemetry** collector/exporter build-out · **staff MFA**
(email-code-only is a conscious beta exception — note it in ARCHITECTURE) · advanced PWA/CDN cache tuning ·
load testing.

---

## Suggested order

~~B1+B2~~ ✓ → ~~D1~~ ✓ → ~~D4 + D7~~ ✓ → ~~D2 + D3~~ ✓ → ~~C1~~ ✓ → ~~E — first feedback round (beta) on
AWS~~ ✓ → **D5 / D6** (badges, parent email) next, now that real families are giving feedback. **C2** (a
concrete new exercise type) slots in whenever the content work calls for it.
