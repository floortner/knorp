# ROADMAP.md

**Single source of truth for the forward plan** across *besserlesenschreiben* — backend (`-api`),
frontend (`-web`), trainer (`-trainer`) — and the top-level `e2e/` suite. The specs describe *what
the system is*; this file tracks *what's left to build*. **Shipped detail and the pivot log live in
`HISTORY.md`** — when a milestone ships, tick it here and move its detail there. Section letters
(§A…§J) are stable across both files.

## Status & order

Everything through the beta deployment is **done and live** (HISTORY.md): backend + family app +
trainer portal on real HTTPS domains, €50/mo all-in budget, full ★ AI enabled with beta caps. The
teaching console (§H1/§H3) and the content pipeline (§I) shipped 2026-07-25/26.

**Now:** the content side owns the critical path. The §F export landed 2026-07-27
(`content/linguist-contrib/iteration-1/`); engineering's Rückmeldung went back
(`content/linguist-contrib/RUECKMELDUNG-ENGINEERING.md`). Since 2026-08-06 the content side is
**one linguist — Angelika — authoring in-repo via Claude Code** (HISTORY.md pivot log): the open
answers, above all the skill-tag taxonomy, are expected to be drafted in her Claude sessions with
her pedagogical sign-off (see §F).

**Then, in rough order:** §F implementation as the answers land (word-list schema → taxonomy →
training types → sequence → lecture prompt) · **D5/D6** (badges, weekly parent email) once real
content is live · **C2** is *how* new exercise types land during §F · **§J** rides alongside — J1
(digest hardening) with §F's taxonomy, J2–J4 (content analytics) once real content produces
telemetry, J5 piecemeal (the robust-`time_ms` fix anytime) · §G's P3 remainder opportunistically.

**Parked options:** §H4 (paper delivery channel — designed, build on demand).
**Deferred:** billing (app is free; access gated by staff approval — ARCHITECTURE §1b/§9) · TTS
pipeline (Web-Speech fallback for now; target Amazon Polly) · full-prod hardening
(multi-instance/ALB, managed RDS + DR, OTel collector build-out, staff MFA — ARCHITECTURE §7).

---

## Forward plan

### A. Hardening & best practices — ✅ DONE → HISTORY.md §A

### B. Remove / simplify — ✅ DONE → HISTORY.md §B

### C. Extensibility

1. **Age property** — shipped, then dropped with the lexeme foundation (HISTORY.md §C1). The
   profile-side counterpart (grade or birth year — `unlockedUnit` is a weak age proxy) remains an
   open, independent idea for whenever profile-level age targeting is wanted again.

2. **New exercise / test types (open — this is where the §F content redesign lands them).**
   Per-type cost is fixed and safe; the drift gates catch everything. Starts from the single
   `placeholder` type in `src/contract/exercise.ts`.
   - **Backend:** `src/contract/exercise.ts` (Zod variant, extend the `discriminatedUnion`, a
     `superRefine` case in `solvableExerciseSchema` so it can't emit an unanswerable item) →
     `exercise.spec.ts` solvability test → content for the new type (via the §I content pipeline) →
     `sessions.service.ts` `LLM_SYSTEM` (only if LLM-generatable) → `npm run openapi:export`.
     **Note:** the old 14-type union approached strict tool-mode's limits — keep the wire schema
     strict-agnostic, leave solvability enforcement post-hoc, don't re-enable strict.
   - **Content pipeline:** extend the frontmatter schema (`backend/src/content/lecture-file.schema.ts`)
     + the German guide in `content/README.md` — authoring is markdown, never a form (§I).
   - **Frontend:** `ExerciseView.tsx` dispatch case (reuse `SingleChoiceExercise` where the shape
     fits) → `derive.ts` `promptAndExpected()` (stay total over the union) →
     `fixtures/session.example.json` golden example per type → `ExerciseView.spec.tsx` →
     `npm run gen:api`.
   - **Telemetry (per-type decision at ship time):** define the type's `given` serialization
     deliberately — a flat string is perfect for choice types but loses structure for
     reorder/grid/typed-input types; the `derive.ts` case is where the convention lives. For
     typed-input types decide whether to capture the pre-correction answer (`givenFirst` — §J5;
     raw keystrokes stay off-limits on principle).
   - **Trainer:** none — exercise types don't surface in the staff portal.

### D. Frontend engagement & retention

Constraint (correct for struggling readers): calm feedback, **no lives/energy/dark patterns**.
D1–D4 + D7 shipped (HISTORY.md §D).

5. **Badges (OPEN).** The SVG policy reserves them and `review_state` already knows mastery:
   "Silben-Meister", 7-Tage-Serie, unit badges, shown in `/profil`. Medium effort (small backend
   addition).
6. **Weekly parent email (OPEN — highest leverage for the target audience).** Retention at this age
   runs through the parent. `digest.md` already computes everything — a Friday "Mia hat 3× geübt,
   stark bei Silben, als Nächstes: Dehnungs-h" via the existing email service turns parents into
   the reminder system, without pushing notifications at a student.
8. **Spoken praise variety (later — needs Polly).** Audio reward beats visual for pre-readers.

Smaller noted gaps from the 2026-08-06 frontend consistency audit (each needs a small `/profil`
surface; backend support already exists):
- **A11y settings UI.** `dyslexicFont` + `fontScale` are applied at runtime but have no editing UI
  (frontend SPEC §6 known-gap note) — the controls were cut in milestone 1.6 and never returned.
- **Weekly goal editing.** `goal` is set once in onboarding and never editable again.
- **Second student profile.** The API is plural but the app hardcodes `profiles[0]` — a family with
  two students can't reach the second profile (needs a switcher + product decision).

> Deliberately **not** recommended: push notifications to the student, real leaderboards, time
> pressure, loss mechanics — antagonistic to a remedial-literacy audience and to the stated values.

### E. First feedback round (beta) on AWS — ✅ DONE → HISTORY.md §E

### F. Content-set redesign — **the next step (externally driven)**

**Goal:** design and rebuild the pedagogical content layer from scratch — a new word-list schema,
training types (replacing the single `placeholder` scaffold), a unit/sequence catalogue, and the
LLM lecture-generation prompt — on top of the skeleton kept from the Vokaltraining program (auth,
homework review, chat, staff portal, AWS deploy, telemetry, FSRS, the contract pipeline). The
linguist's material lands as **markdown files in `content/`** (§I): contract-touching steps (2, 3,
6) are unchanged; content/curation steps (4, 5, 7) should be read through the §I lens — unit/bank
content may also live in the content library (open design question), and a staff curation surface
is likely never needed.

> **Current state (2026-07-27):** the linguist export landed in
> `content/linguist-contrib/iteration-1/` (canonical: `lernapp3-opus.md` + nine `BLS_*.html`
> chapter plans with ~40 playable prototype exercises incl. real item data). Engineering's
> Rückmeldung (`content/linguist-contrib/RUECKMELDUNG-ENGINEERING.md`) committed to building the
> **10 proposed exercise types in one wave** (incl. a composite-telemetry design for
> SortIntoBuckets/DragAndOrder/PairMatching/CatchFalling), keeps the app brand + Nepo/Stella buddy
> choice, ignores the export's own SQL model, and contains a capacity model (built prototypes ≈ 1/3
> of a 6–9-month training run, full export ≈ 2/3) plus a **generator proposal** (annotated word
> pool × type templates) to close the rest. **Blocked on the content side's answers** — above all
> the skill-tag taxonomy (expected as `content/linguist-contrib/fertigkeiten.md`; under the
> 2026-08-06 solo model drafted in-repo in Angelika's Claude sessions — engineering still must not
> substitute for her pedagogical sign-off), plus item material for the "zu bauen" exercises, the per-item
> wrong-feedback fields, Kugel/☆ artwork, and the fate of Kapitel 2–6 / custom one-offs.

> **Re-creation reference.** The complete working Vokaltraining implementation (the `Lexeme` model,
> 14 exercise types with solvability rules, 7-unit catalogue, full `LLM_SYSTEM`/`FEW_SHOT` prompt
> with word-pool grounding, `gen-items-from-lexemes.ts`, the Wortschatz tab, the corpus) is
> preserved at **commit `0d4948b`** — re-creation is fill-in-the-slots against a working reference
> (`git show 0d4948b:<path>`), not invention from a blank page.

**What survives (the slots to fill):** the contract pipeline; `solvableExerciseSchema` + the
`EXERCISE_TYPES` gate; the (empty) `ItemBank` table; FSRS per `skill_tag`; telemetry; the digest
roll-up; the `LlmService` forced-tool/Zod-revalidate path — all keyed on *opaque*
`skill_tag`/`exercise_type` strings, so they carry over to any taxonomy. Frontend:
`ExerciseCard`/`ChoiceTile`/`useAnswer`/`SingleChoiceExercise`, the `ExerciseView.tsx` dispatch,
`derive.ts`, the golden-fixture harness.

**Sequence** (each step ends green — drift gates + golden tests catch mistakes):
1. **Word-list schema.** Re-add a `Lexeme`-equivalent model (migration). Which linguistic facts to
   keep vs. FRESCH-specific columns; re-derive the base list fresh vs. restore the corpus
   extraction. **Proposed direction (Rückmeldung, pending Angelika's reaction): the generator
   approach** — an LLM-annotated ~1,000-word pool, cross-checked by the rules that are already
   algorithms (the Dehnungs-h decision tree), disagreements routed to trainer review; Angelika
   signs off the annotation schema + spot-checks rather than authoring items.
2. **Skill-tag taxonomy** (`src/contract/skills.ts`) — replace `SKILL_TAGS = ['placeholder']`.
   This is the **spine**: FSRS scheduling, digest roll-up, LLM targeting. Arrives as
   `content/linguist-contrib/fertigkeiten.md` (two tables: Kennung/description/chapter +
   exercise-code mapping).
3. **Training types** (`src/contract/exercise.ts` + renderers) — grow the union per the §C2
   playbook; all 10 export types in one wave, incl. the composite-telemetry design for the four
   multi-step types (§J5.5).
4. **Sequence** (`sessions/units.catalog.ts`) — populate `UNIT_CATALOG` (currently `[]`) +
   per-unit Merksätze + theme colors. Mirror in `frontend/fixtures/units.example.json`.
5. **Content ingest.** Port the built prototype exercises from `iteration-1/` into `content/`
   lectures (engineering ports, Angelika reviews by PR); new items authored by Angelika in
   the extended format. If the generator direction is confirmed, restore/rewrite
   `gen-items-from-lexemes.ts` against the annotated pool.
6. **Lecture-generation prompt** (`sessions.service.ts` `LLM_SYSTEM`/`FEW_SHOT`) — rewrite
   per-type solvability rules + few-shots; re-add word-pool grounding if the schema wants it. At
   ~10+ types, select per-type rules + few-shots at generation time instead of one static prompt.
7. **Trainer curation surface** — decide whether the new word-list schema needs a staff curation
   tab (the old Wortschatz tab is at `0d4948b` as reference). Likely not (§I).

**Cross-cutting §F design notes:** the content schema should carry a **printable** notion before
audio-dependent types land (§H4 depends on it); per-item feedback fields
(`feedbackRichtig`/`feedbackFalsch`/`vorgeloest`) join the frontmatter schema pending Angelika's
confirmation.

**Docs to re-true when this lands:** `backend/SPEC.md` §2/§3/§8, `frontend/SPEC.md` §3, both
`CLAUDE.md`/`AGENTS.md` exercise sections, `content/README.md`, and this file.

### G. Security review follow-ups

Full review in `SECURITY_REVIEW.md`; tracking issue **#81**. P1, P2, and P3 batch 1 are done
(HISTORY.md §G).

- **P3 remaining — DEFERRED (do here, opportunistically):**
  1. 6-digit family login code (align with staff; touches the code regex + tests).
  2. Normalise emails (`trim().toLowerCase()`) at the auth boundary (family + staff).
  3. Dedicated image-token secret instead of reusing `STAFF_JWT_SECRET`.
  4. Scope the S3 blob lifecycle rule to the `…/homework/` prefix (not all of `users/`).
  5. Operational CloudWatch alarms (instance status-check, disk-full, cert-renewal) → SNS topic.
  6. GitHub deploy approval gate (environment protection + OIDC `sub` scoped to
     `environment:beta`) and SHA-pin third-party actions.
- **Operator actions (not code):** `terraform validate`/`plan` + staging CSP smoke-test before
  apply; provision a write-only backup token + `HEALTHCHECK_URL` (cloud-init installs age/rclone;
  the deploy auto-enables the timer once `/etc/blsb/backup.env` exists); re-verify the dormant P2-4
  taxonomy filter once `SKILL_TAGS` is populated in §F. (All in #81.)

**Data-retention decision (2026-08-06):** user and telemetry data in the DB — accounts, profiles,
sessions/attempts (incl. transcribed homework answers in `attempt.given` and the
`llm_analysis`/`reviewed_analysis` JSON), chat, FSRS state — is **retained indefinitely**; deletion
happens **on request via the admin** (`DELETE /staff/users/{id}` erases all DB rows + the account's
blobs — shipped), plus the family-side self-service resets (progress/chat). Raw homework **images**
keep the short S3 lifecycle (currently 90 days; P3 item 4 above scopes the rule to the homework
prefix so other blobs aren't swept). Backups inherit the provider's lifecycle rules.

### H. Lectures + student tracking — the trainer portal as teaching console

**Shipped** (HISTORY.md §H1/§H3): trainers assign content-library lectures to specific students
(pin-at-assign versioning, offer-not-push) and review thoroughly what each student did (activity
timeline, per-question drill-down, digest section). H2 authoring was cancelled for the §I content
pipeline (pivot log).

**H4 — paper delivery channel: assign a lecture as a printed worksheet — OPTION, parked 2026-07-27
(designed, not built):** some students should get a lecture **on paper** instead of in the app. The
design is settled and deliberately cheap; pick it up as-is when the need is real:
- **Tracked channel, not a print button:** `assignment.delivery_channel` (`app` default | `print`,
  string column, additive migration). A paper assignment shows in the portal's Zuweisungen table
  (Papier tag) but **never surfaces in the family app**: the family `GET /assignments` read filters
  to `app`, and `createAssigned` scopes its selector the same way (a paper assignment is a plain
  404 there — unplayable even with a guessed id).
- **No session, no telemetry → manual completion:** paper rows go `open → completed` (never
  `started`; the derived-status logic needs no change) via a new all-trainer route
  `POST /staff/lectures/{id}/assignments/{id}/complete`, valid only for the print channel (app
  assignments complete exclusively through their session). Assign body gains an optional
  `channel` (default `app`); cross-version dedupe stays channel-agnostic. Withdraw unchanged.
- **PDF is client-side** — a print-styled portal route (`/lectures/:lectureId/print`, outside the
  AppLayout chrome) + `window.print()` → browser "Save as PDF". Worksheet (title, Name/Datum line,
  Merksatz, numbered exercises with checkbox options) + optional Lösungsblatt on a
  `break-before-page`. No backend PDF dependency, no binary endpoint — the contract pipeline and
  `api.ts` stay JSON-only. AssignDialog gets an "In der App / Auf Papier" choice with a
  "Jetzt drucken" follow-up.
- **§F coupling:** only `placeholder` exists today, which prints fine. When §F introduces real
  exercise types, audio-dependent ones can't go on paper — the new content schema should carry a
  printable notion and the print view/assign flow must respect it (noted in §F).
- Out of scope when built: server-rendered/archived PDFs, per-student pre-filled sheets, paper
  outcomes beyond done/not-done (the homework-photo review loop is the paper feedback channel).

### I. Content pipeline — ✅ DONE → HISTORY.md §I

Lectures are markdown files in `content/` — CI-validated, versioned deploy import, pin-at-assign.
§I's durable anchors (slug, `{slug}.{exId}` lineage, content-addressed item rows) are the substrate
**§J** consumes for content-effectiveness analytics.

### J. Content feedback loop — telemetry → content quality (planned 2026-07-27)

**Goal:** close the missing half of the improvement cycle. Today all four feedback loops flow
telemetry *forward* into what one student gets next (attempt→FSRS, weak/due→bank selection,
focus+digest→generated lecture, homework verdict→FSRS — ARCHITECTURE §12), and every read model is
**student-indexed**. Nothing aggregates by **content**: nobody can answer "which of the lectures
underperforms," "is this exercise badly worded (90 % wrong, 30 s average)," or "did v2 beat v1" —
even though §I built exactly the durable anchors for it. §J adds the content-indexed half and the
channel back to the authors.

**Why now-ish:** at the target scale (≈10+ exercise types × ≈200 lectures × generated lectures ×
detailed telemetry), content improvement cannot run on trainer anecdotes. The content author's only
feedback today is CI validation — whether a file is well-formed, never how it performs.

**Channel decision (settled 2026-07-27; re-weigh J4's priority at build time): one shared analytics
read model, two consumers.** Trainers get a portal screen (J3); the content-authoring role gets an
**anonymized aggregate report exported into the repo** (J4) — repo access sits outside the staff
DPA, and the repo is already the authoring interface: the deploy pipeline is the write API, the §J4
report the read API. Note (2026-08-06): Angelika, the one current author, is also a trainer and can
read J3 directly — J4 is therefore less urgent than when it was the authors' only channel, but its
privacy rule is unchanged (authoring must never require staff access; ARCHITECTURE §1a).

**J1 — digest hardening (build when §F's taxonomy lands; independent of J2–J4):** the digest is
the main prompt-size risk under a real taxonomy — its attempt fetch is uncapped (14-day window, no
`take`, unlike the session paths' 200-row cap) and the per-skill table + FSRS-due list are
unbounded. Cap the fetch, top-N the skill table (weakest-first, ~12) and the due list; keep the
existing caps (wrong-answers 8, assigned lectures 5). Files:
`src/services/digest/digest.service.ts`, `digest.render.ts` + golden digest test update.

**J2 — content-analytics read model (gated on: real §F content + real telemetry to aggregate):**
aggregates over `attempt` joined to `item_bank`/`lecture` — per **item lineage** (`{slug}.{exId}`
across versions, derived from the `content:` seed_key prefix), per **exercise type**, per **lecture
slug**, and **per version** (v-compare): attempts, first-try correct %, avg `time_ms`, retry rate,
abandon rate. Minimum-N floor baked into the read model (suppress aggregates with too few
students/attempts), so every consumer inherits it. Read-side only — plain Prisma groupBy/SQL is
fine at beta scale; no schema change expected.

**J3 — portal „Content-Qualität" screen (all trainers):** worst-performing lectures/items ranked,
per-lecture drill-down with per-exercise stats, v(n) vs v(n−1) comparison — the trainer-facing
consumer of J2. Also the 200-lecture browse scale item: search/filter by skill tag in the Lektionen
list. German copy, lucide icons only, no emoji.

**J4 — repo report for the linguists:** `npm run content:stats` renders the J2 aggregates into a
generated report in the repo (proposed `content/stats.md`; committed via PR or published as a CI
artifact — decide at build time). **Privacy rule (hard): content-indexed aggregates only** —
counts, percentages, average times per lecture/exercise/type — with the J2 minimum-N floor; never
a student name, profileId, or any per-student row. Repo access sits outside the staff DPA; this
report must stay safe to read by anyone with repo access (the rule holds even though the current
author is also a trainer — see the channel note above).

**J5 — telemetry v2 (small additive capture improvements; each lands with its natural trigger):**
1. **Robust `time_ms` (build anytime — a correctness fix, not a feature):** the timer runs from
   item mount to answer, so a backgrounded tab or a dinner break inflates it unboundedly — and the
   weak-skill heuristic (>15 s avg) and the digest's „Ø Zeit" read it as "slow at this skill".
   Pause the timer via the Page Visibility API in the frontend, and winsorize (cap ~60 s) in every
   aggregation (`session-select.ts weakSkills`, digest, J2).
2. **`audio_plays` on `attempt` (lands with the audio/TTS work):** "played the audio 4× before
   answering" is a stronger reading-difficulty signal than time for this audience. Trivial additive
   column + one counter in the exercise scaffolding.
3. **Generation provenance on `item_bank` (lands with §F6):** stamp `generatedBy:'llm'` rows with
   model id + prompt version (additive columns) — enables "items from prompt v3 outperform v2".
4. **Roll up `agreed_with_llm` (lands with J2):** stored per homework review since §H, never
   aggregated — one J2 query measuring vision-analysis quality over time.
5. **Per-type `given` serialization + `givenFirst` for typed input; composite-attempt design for
   the multi-step §F types (SortIntoBuckets/DragAndOrder/PairMatching/CatchFalling):** decided
   per type as §F types land (§C2 playbook telemetry step).
- **Explicitly NOT captured (privacy stance, load-bearing):** keystrokes, cursor/touch traces,
  device fingerprints, session recordings. The restraint is what keeps the J4 report and the whole
  minors-data story clean. Abandonment needs no new capture — the drop-off item is derivable from
  the last answered position vs. `session.item_ids` order (a J2 computation).

> The LLM **generation** side of the cycle scales separately: at ~10+ types the single static
> `LLM_SYSTEM` prompt becomes per-type few-shot selection — that work stays in **§F step 6**, not
> here. §J is about measuring content, §F6 about generating it.
