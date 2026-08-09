# HISTORY.md

The shipped record and pivot log for *besserlesenschreiben*. **`ROADMAP.md` holds the forward
plan**; when a milestone ships, its detail moves here. Section letters (§A…§J) match ROADMAP's
plan, so cross-references like "§I2" resolve in either file.

## Pivot log

The decisions that reshaped the project — recorded **once, here**. The other docs describe only
the current system.

- **2026-07-13 — Vokaltraining content set dropped** (`chore/drop-vokaltraining-content`): the
  lexeme foundation (`lexeme` table, `lexeme.seed.json`/overrides, `data-foundation/` corpus +
  `parse-rwe.py`, `npm run gen:items`), the 14 exercise types with their renderers, the 7-unit
  catalogue, `item_bank.seed.json` + the seed loader half, and the trainer Wortschatz tab. The
  content layer is being redesigned from scratch (ROADMAP §F). The complete working implementation
  is preserved at **commit `0d4948b`** (parent of the drop commit) — re-creation is
  fill-in-the-slots against a working reference: `git show 0d4948b:<path>`.
- **2026-07-15 / 2026-07-25 — pseudonymisation retired → known-trainer model:** the 2–3 trainers
  know each student personally, so staff surfaces show the **real student name + learning data**;
  the `L-xxxxxx` pseudonym handle was deleted (`profileId` is the stable id) and
  `queue/{id}/progress` opened to all trainers. Parent email + account lifecycle stay
  **admin-only**. (Originally designed for anonymous reviewers; the product reality superseded it.)
- **2026-07-22 — Eltern-Bereich + parent PIN removed:** the `/parent` area, 4-digit PIN gate, and
  the `ParentScopeGuard`/`parentToken` machinery were deleted — the trainers know each family
  personally and the PIN was more friction than protection. "Lernfortschritt zurücksetzen" and
  "Chat löschen" moved to the Profil tab behind two-step confirmations
  (`POST /profiles/:id/reset[-chat]`, ownership-checked). The `account` PIN columns were removed in
  **two releases** for deploy-window safety (schema/client first, `DROP COLUMN` once no serving
  binary selected them).
- **2026-07-26 — §H2 portal authoring cancelled → content pipeline (§I):** lecture authoring moved
  to markdown files in repo-root `content/` (linguists author via GitHub PRs, CI validates,
  versioned deploy-time import). The portal's editor + lecture write routes were removed (§I3);
  the portal is browse + assign + track. A new exercise type now ships a frontmatter-schema
  extension, not an authoring form.
- **2026-07 — billing removed from the roadmap:** the app is **free, including AI**; access is
  gated by staff approval of the account (ARCHITECTURE §1b). The dormant
  `entitlement`/`credits_ledger`/`processed_webhook` tables were dropped — re-add by migration if
  metering is ever introduced (ARCHITECTURE §9).
- **2026-08-06 — linguist team → solo in-repo authoring (Angelika):** content authoring moved from
  "linguist group delivers via GitHub web editor/PRs" to **one linguist, Angelika** (non-technical,
  also a trainer), writing lectures directly in the repo with Claude Code under `content/CLAUDE.md`
  (`/neue-lektion` + `/abgeben`, German-only sessions, `content/`-scoped; `.claude/settings.json`
  allowlist). `main` is branch-protected (PR + review, Flo merges). §F deliverables (above all
  `fertigkeiten.md`) are now expected to be Claude-drafted in her sessions with her pedagogical
  sign-off. Authoring stays a role outside the auth realms (ARCHITECTURE §1a) — her trainer account
  is separate from the authoring path.

---

## Shipped

### Backend / cross-cutting

**Phase 1 — free tier:**
1. ✅ Auth (email code + JWT, httpOnly cookie + logout), account/profile, settings, ~~parent PIN~~
   (removed 2026-07-22, see pivot log).
2. ✅ Item bank: unique `seed_key` column on `item_bank` (idempotent upsert-on-`seed_key`). The
   seed content itself was dropped 2026-07-13; the table + `seed_key` shape remain, so re-seeding
   is a loader + seed file, not a migration.
3. ✅ Sessions (bank) + attempts ingest + progress + FSRS.
4. ✅ Digest generation.

**Phase 1.5 — hardening:** runtime response-contract validation (`ZodResponseInterceptor`); httpOnly
cookie auth + `/me`-probe frontend; ~~durable PIN lockout~~; prod email (Resend) + object-storage
adapters (fail-loud, no silent no-op); 201 statuses on creating POSTs; FSRS `learning_steps`
persistence; React error boundary + renderer safety; offline session caching + telemetry retention;
guard/flow tests; the docs.

**Phase 1.6 — content + UX polish:** auto-unlock next unit on session complete (atomic, backend);
all-units-complete celebration; ~~5 new exercise types~~ (dropped with Vokaltraining);
~~parent area~~ (removed 2026-07-22); profile Ton toggle wired end-to-end.

**Phase 1.6 technical debt — RESOLVED:** parent-scoped ids bound into the token at issue (machinery
since removed with the PIN); `apiFetch` per-request `token`; `sessionCompleteSchema.allUnitsComplete`
(backend authoritative); `isApiError` guard replacing unsafe casts.

**Phase 2 — free AI features + approval-gated access (★):**
5. ✅ **`LlmService`** — abstracted; Anthropic-direct dev default; structured output via a forced
   tool whose `input_schema` is the JSON Schema of the caller's `src/contract` Zod schema,
   re-validated (incl. per-type **solvability**) with a one-shot re-ask on a contract miss;
   EU-residency gate before prod; canned/stub path when `ANTHROPIC_API_KEY` is unset. Model policy:
   `ANTHROPIC_MODEL` = `claude-sonnet-5` (generation/chat, upgraded 2026-08-09), `ANTHROPIC_VISION_MODEL` =
   `claude-opus-4-8` (homework OCR); no `temperature`/`top_p`/`top_k`; stable system prompts sent
   as cacheable blocks.
6. ✅ **Chat** (free ★).
7. ✅ **Homework upload + vision draft (family side).** `POST /homework` → storage (EXIF strip,
   WebP) → Claude vision → `llm_analysis` draft, `status='pending_review'`, enqueued for staff
   review. Nothing mutates the profile until a trainer approves.
8. ✅ **LLM session generation** — folds a reviewed upload's `reviewed_analysis.suggestedFocus`
   into the next on-the-fly lecture; generated exercises validated for solvability.

**Phase 2 access-control — approval-gated signup + staff user-admin:**
9. ✅ **Account lifecycle.** `account.status` (`pending|active|deactivated`); silent
   pending-on-first-code (no email until approved); family `JwtAuthGuard` requires `active`.
10. ✅ **Staff user administration (admin role only).** `GET /staff/users`, approve / deactivate /
    delete (erases DB + blobs); trainer-portal admin screens.

~~Billing (entitlements, credits, webhook, pay-it-forward)~~ — removed (pivot log).

**Phase 2.5 — professional review + staff portal:**
11. ✅ **Staff realm foundation.** `trainer` + `homework_review` tables; `StaffAuthGuard`
    (`aud:"staff"`, disjoint `STAFF_JWT_SECRET`, realms mutually rejecting); staff login (email
    code, own httpOnly cookie) + `GET /staff/me`; ~3 trainers admin-seeded (no self-signup).
12. ✅ **Review queue + authoritative apply.** `GET /staff/queue` (cursor-paged, per-upload
    short-lived presigned `imageUrl`); claim/lease (`409` if held); `POST /staff/reviews/{id}`
    writes `reviewed_analysis`, derives `attempt` rows + adjusts `review_state`, records the
    LLM-vs-trainer diff (`agreed_with_llm`). (Shipped pseudonymised; real names since 2026-07-25.)
13. ✅ **Lecture wiring + family status.** `suggestedFocus` folds into the next lecture; `-web`
    surfaces `pending_review → reviewed` + the read-only authoritative result (no confirm UI).
14. ✅ **Trainer portal** (`besserlesenschreiben/trainer`) — thin client over `/staff/*`,
    desktop/tablet landscape: shell + staff auth; queue + claim; two-pane review screen
    (approve / correct / reject).

**Post-2.5:**
- ~~Lexeme foundation~~ — dropped 2026-07-13 (pivot log).
- ✅ **Trainer portal expansion** — brand-aligned chrome, nav count badges, queue history,
  admin-only learner-progress views.
- ✅ **Trainer workflow batch (2026-07-14, #79)** — queue paging/waiting-since/claim locks,
  read-only history detail, submit→next-item flow, unsaved-changes guard, reject confirmation,
  image lightbox, Profil tab (`PATCH /staff/me`), admin email search. Trainer copy emoji-free,
  lucide icons only.
- ✅ **Homework-in-chat** — upload moved into the family Chat tab; durable photo + status bubbles;
  verdict echoed in-chat.
- ✅ **E2E harness** — top-level `e2e/` Playwright suite; run locally only, intentionally not in CI.
- ✅ **AWS retarget** — S3 storage adapter (presigned URLs), Frankfurt region docs.

### Frontend (`-web`)

**Phase 1:** app shell, routing, tab nav, API client, cookie auth + `/me` probe; onboarding
(buddy + goal); `/lernen` home + unit cards + session fetch; telemetry plumbing (fire-and-forget
`POST /attempts` with real `timeMs`, offline queue + retry); the exercise renderers (one attempt
per item); progress + voice + accessibility settings.

**Phase 1.5:** error boundary + renderer safety; offline session caching (PWA); committed
`api.gen.ts` + drift gate; flow tests.

**Phase 1.6:** auto-unlock next unit; celebration; ~~parent area~~; Ton toggle.

**Phase 2:** Chat (★) + the ✨ generated-lecture entry on `/lernen`; homework "Foto & verbessern"
in the Chat tab. No billing UI — the app is free.

**Family-app tweaks (2026-07-14, #77/#78):** parent "Chat löschen" fully wipes chat + homework
(rows, audit cascade, blobs); editable username (10 chars) + read-only login email; Angelika SVG
as chat trainer icon. **Regression fix:** civil-day/week bucketing UTC → Europe/Berlin
(`common/dates.ts`, DST-safe) — corrects week strip, streak, daily caps, joker week, heatmap.

> The staff trainer portal is a separate subproject (`besserlesenschreiben/trainer`) — the only
> homework surface in `-web` is upload + status in the Chat tab.

### 2026-08 — maintenance & fixes (post-audit burst, 08-08/08-09)

- ✅ **Night mode** end-to-end (#107, #109): per-profile `appearance` (auto|light|dark, contract
  field + migration), semantic color tokens replacing all hardcoded colors, `html[data-theme]`
  dark palette, no-flash boot script, Profil "Aussehen" (RadioRow primitive). Trainer untouched.
- ✅ **Trainer login-hang fix** (#108): #104's 401-handler `removeQueries(['staff-me'])` detached
  the mounted me-probe — every staff login hung on "Lädt …". Never deployed; caught by e2e.
- ✅ **Quick wins** (#112): a11y settings UI (Schriftgröße presets + "Extra Abstand"), Wochenziel
  editing (GOALS shared with onboarding), anti-crutch chat guardrail (never supply the target
  spelling), TTS fallback rate 0.85→0.75. Closed two 2026-08-06 audit gaps.
- ✅ **Robust `time_ms`** (#111) → §J5.1 below. **UpdatePrompt spec** (#114) — the mid-lesson
  update-suppression promise finally pinned by tests.
- ✅ **Servable exercise-type guard** (#118): `servableExerciseWhere` on every item read — retired
  types (e.g. leftover pre-drop Vokaltraining rows) can never reach the wire again; §F insurance.
- ✅ **`inference_geo` outage fix** (#119, #121): #105's hardcoded `'eu'` 400'd every LLM call
  (org allows global/us only) — now env-gated `INFERENCE_GEO`, blank omits; SSM placeholder
  dropped (SSM rejects empty values). Caught before it could reach prod.
- ✅ **Sonnet 5 upgrade** (#120): `ANTHROPIC_MODEL` → `claude-sonnet-5`; llm-smoke fully green
  (the heavier tokenizer even pushed the prompt prefix back over the cache minimum).
- ✅ **Docs/process:** contract-regen playbook corrected — both SPAs type the FULL OpenAPI (#110);
  Duolingo research corpus + evidence synthesis + derived proposal roadmap (#106,
  `content/academia/`); §D6 parent-email design settled and parked on §F (#113).

---

## §A — Hardening & best practices (DONE)

1. ✅ Request-level rate limiting — `@fastify/rate-limit`: 10 req/min `/auth/*`, 300/min
   elsewhere, loopback exempt for e2e (PR #49).
2. ✅ E2E upload → trainer verdict → chat-status seam — `homework-loop.spec.ts` cross-realm
   journey (PR #50).

## §B — Remove / simplify (DONE)

All four shipped in PR #49: deleted `scripts/build-seed.ts`; dropped dead `TTS_*`/`BILLING_*` env;
expired login-code cleanup (scheduled with §E5); trainer claim released on leaving the review
screen.

## §C1 — Age property (DONE, then dropped)

Shipped end-to-end (`ageBand`, `gradeBand()` word-pool selection, Wortschatz filter) and removed
with the lexeme foundation 2026-07-13. A profile-side age/grade field remains an open independent
idea (ROADMAP §C).

## §D1–D4, D7 — Engagement (DONE)

Buddy states wired to live progress (PR #51); `GoalCard` + `WeekStrip` (PR #54); session-end
forward hook (PR #54); kind streaks + weekly Streak-Joker (PRs #52/#53); `/liga` → "Erfolge"
(PR #52).

## §E — First feedback round (beta) on AWS (DONE)

**Goal:** backend + both frontends on real HTTPS domains for ~10 families and 1–2 trainers, inside
**€50/mo all-in (AWS + Anthropic)**. That budget drives the architecture: no ALB, no managed RDS
(self-hosted Postgres on the box), single region.

**Architecture:** one EC2 `t4g.small` running `node dist/main.js` under systemd, self-hosted
Postgres on the same box, nginx + Let's Encrypt terminating TLS for `api.<domain>`, S3 blob bucket
via IAM instance role; both frontends on S3 + CloudFront (`app.` / `trainer.`, pre-rename `review.`), ACM in us-east-1;
one Route-53 domain so the `SameSite=Lax` cookie flows subdomain↔subdomain. Secrets in SSM
Parameter Store, rendered to a root-only systemd `EnvironmentFile` at deploy. Deploys from GitHub
Actions via **OIDC → scoped IAM role → SSM Run Command** (no static keys, no SSH). All Terraform
in `infra/`.

Checklist (all ✅): Terraform infra (EC2 + EIP + SGs, IAM roles, OIDC deploy role, buckets + OAC +
CloudFront, ACM, Route 53 + SES DKIM, SSM params, AWS Budgets alert + spend-cap auto-stop) · box
bootstrap (`infra/cloud-init.sh.tftpl`, `deploy/` — Node 24, Postgres, nginx, certbot,
`blsb-api.service`) · GitHub Actions deploy (`deploy.yml`, manual `workflow_dispatch` only; api
job via SSM → `release.sh` with pre-traffic `migrate deploy`; web job build + `s3 sync` +
invalidate) · prod config in `infra/ssm.tf` (SES email, beta caps `LLM_SESSIONS_PER_DAY=3` /
`CHAT_MESSAGES_PER_DAY=20`, `LLM_RESIDENCY_ACK`) · off-platform backup **scaffolding** (`deploy/backup.sh` daily
`pg_dump` → `age`-encrypt → non-AWS remote via rclone; tools installed by cloud-init and the timer
auto-enabled at deploy once the operator supplies `/etc/blsb/backup.env` + the rclone remote —
retention via provider lifecycle rules, not the earlier 7d+4w scheme) · full ★ AI on, watched.

**Observability:** OTel chosen, collector build-out deferred. (The round-1 "free uptime ping on
`/api/v1/health`" was never wired up in-repo — external checks and CloudWatch alarms remain the open
P3 item in ROADMAP §G.)

## §G — Security review (ALL P1/P2/P3 code shipped)

Full review in `SECURITY_REVIEW.md`, tracking issue #81. **P1 (PR #80):** parent-PIN reset bypass,
`blsb`→root deploy escalation, security headers + CSP, JWT out of the `/auth/verify` body.
**P2 (PR #80):** SW-cache offline-logout bypass, telemetry-queue clear on logout, login-code resend
throttle, homework skill-tag sanitisation, student name out of the LLM digest, API bound to
localhost, backup dead-man's-switch. **P3 batch 1 (#82):** Swagger gated out of prod, `VITE_API_BASE`
guard, `qc.clear()` on logout, `dnf-automatic`, systemd hardening, CSRF note.
**P3 batch 2 (#115, 2026-08-09, from a cloud review session):** 6-digit family login code
(backend + CodeScreen), email normalisation at both auth boundaries, dedicated optional
`IMAGE_TOKEN_SECRET`, homework-photo S3 lifecycle by object tag (`class=homework`) +
`s3:PutObjectTagging`. **P3 batch 3 (#117, applied + activated 2026-08-09):** CloudWatch ops
alarms — EC2 status check, root + pgdata disk ≥85%, TLS cert ≤14 days — live on the budget SNS
topic, fed by a 5-min on-box metrics timer (`deploy/metrics.sh`, namespace-scoped PutMetricData,
missing-data = breaching; the timer reaches the box with each deploy via `release.sh`); deploy
approval gate — both deploy jobs in the GitHub `beta` environment (created, required reviewer:
Flo), OIDC trust `sub` narrowed to `repo:…:environment:beta`, all workflow actions SHA-pinned.
*(Remaining operator actions: ROADMAP §G.)*

## §H1 + §H3 — The teaching console (DONE 2026-07-25)

Trainers assign lectures to specific students and review thoroughly what each student did. Shipped
as one PR series:

- **H1 rails:** `lecture` + `assignment` tables (assignment pins the lecture version via FK;
  unique lecture×profile); staff routes list/detail (superseded-filtered) / assign to N profiles
  (idempotent, cross-version dedupe) / withdraw / per-student assignment status
  (`open|started|completed`) + outcome rollup; family `/lernen` "Übung von {Trainer}" offer card
  (never a push); `POST /sessions {source:'assigned'}` plays the pinned lecture; completion flips
  the assignment. Contract regen + golden fixtures + e2e `assignment-loop.spec.ts`.
- **H3 tracking:** per-student session history (`GET /staff/students/{id}/sessions` — source,
  timing, `activeMs`, abandoned flag, correct %) + question-by-question session drill-down
  (prompt/expected/given/`time_ms`/`attempt_no`); portal activity timeline + drill-down screens;
  digest "Zugewiesene Übungen" section; abandoned/never-started visible calmly (never "überfällig").
- **Learner directory** (H1.3): student list for all trainers — the assignment picker; shipped the
  known-trainer revision (real names, pivot log).

**Invariants that live on** (now in ARCHITECTURE/SPEC): assigned exercises pass the same
solvability gate as LLM output; assignments are offers, never pushes; assigned-session attempts are
ordinary telemetry; trainers see names + learning data, account identity stays admin-only.

*(H2 authoring was cancelled — pivot log. H4 paper channel is a parked option — ROADMAP §H.)*

## §J5.1 — Robust `time_ms` (DONE 2026-08-08)

`timeMs` measures the student, not the interruption: the frontend attempt timer
(`features/exercises/active-timer.ts`, used by `LessonRunner`) counts only **visible** time —
paused via the Page Visibility API while the tab is backgrounded or the phone locked. Backend
aggregations read `time_ms` **winsorized** at 60s (`src/common/time-ms.ts`): the weak-skill
heuristic (`session-select.ts weakSkills`) and the digest's „Ø Zeit"; raw values stay untouched in
`attempt` rows (drill-downs show the truth, aggregates read it robustly). §J2's analytics must go
through the same helper when it lands.

## §I — Content pipeline (DONE 2026-07-26)

Lectures are markdown + YAML frontmatter files in repo-root `content/lectures/<slug>.md` — the
single source of truth, authored by the linguists via GitHub PRs, validated in CI, imported
versioned at deploy. Decisions: English frontmatter keys mirroring the wire contract, German
authoring guide + German validation errors; `status: draft|published`; **pin-at-assign
versioning** — a changed lecture gets a NEW `lecture` row (version+1, old `superseded`, never
mutated), changed exercises get NEW content-addressed `item_bank` rows
(`seed_key = content:{slug}.{exId}:{hash12}`); slugs + exercise ids are durable telemetry anchors;
`content/skills.lock.json` guards taxonomy drift in CI.

- **I1** format + validator + CI: `content/` (German README, Vorlage, skills lock),
  `backend/src/content/` (frontmatter Zod schema reusing `solvableExerciseSchema`, parser with
  German path-addressed errors, canonical hashing, loader) + specs; `npm run content:validate`;
  CI `content` job.
- **I2** schema + versioned import + deploy wiring: lecture `slug`/`version`/`content_hash`/
  `source_path`/`superseded_at` migration; `npm run content:import` (validate-all-first, per-lecture
  transaction: create/no-op/update-meta/bump/retire — never delete or mutate old rows); deploy
  tarball gains `content/`, `release.sh` imports pre-traffic; e2e fixture content.
- **I3** route + portal reduction: lecture write routes removed; list/detail/assign/withdraw stay
  (cross-version dedupe, version badges); portal editor deleted; e2e rewritten against imported
  fixture content; docs re-trued.

> §I's durable anchors (slug, `{slug}.{exId}` lineage, content-addressed items) are the substrate
> §J consumes for content-effectiveness analytics.
