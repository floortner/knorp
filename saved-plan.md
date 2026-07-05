A. Best practices — close these before the AWS deploy

1. ~~No request-level rate limiting. Domain counters exist (verify-attempt lockout, PIN lockout, daily ★ caps ✓) but nothing throttles raw request volume — /auth/request-code can be hammered to burn email quota, and there's no per-IP limit anywhere. Add @fastify/rate-limit (tight on /auth/* + /staff/auth/*, loose default elsewhere). Half a day, and it's the biggest exposed surface on a public deploy.~~ **DONE** — `@fastify/rate-limit` wired in `main.ts`: 10 req/min for `/auth/*`, 300/min elsewhere, loopback exempt for e2e (PR #49 + allowList fix).
2. Zero observability. No Sentry, no uptime check. Before first users: Sentry on backend + both frontends (PII-scrubbed per §6 — the rules are written, just not wired) and a free uptime ping on /health. Otherwise the first "it's broken" report will come from your wife, not your tooling.
3. Backups are documented, not built. The off-platform encrypted pg_dump cron (ARCHITECTURE §7) should be part of the deploy milestone itself, not after — child data plus a single-instance EC2 is exactly the setup that needs it.
4. Staff MFA is specced "before prod." With one trainer, email-code-only is a defensible exception — but decide it consciously and note it, don't drift into it.
5. ~~E2E coverage misses the seam that broke most this session: upload → reviewer verdict → chat status. One Playwright journey across both realms would guard the whole professional-loop.~~ **DONE** — `homework-loop.spec.ts` cross-realm Playwright journey (PR #50).

B. Remove / simplify

1. ~~Delete scripts/build-seed.ts — it's now a loaded gun. It regenerates item_bank.seed.json from the legacy prototype's 12-type LESSONS; one accidental run wipes your 879-item bank back to the pre-Vokaltraining set. It's referenced in ARCHITECTURE §3 and root CLAUDE.md, so remove those lines too.~~ **DONE** (PR #49)
2. ~~Drop TTS_PROVIDER/TTS_KEY — dead outside env.ts, and wrong for the AWS design anyway (Polly authenticates via the IAM role, no key). Same for BILLING_PROVIDER/BILLING_WEBHOOK_SECRET — the stated plan is "re-add by migration if ever needed"; that applies to env vars too.~~ **DONE** (PR #49)
3. ~~Expired login-code rows accumulate (login_code, staff_login_code) — a one-line cleanup in the future backup cron is enough. Minor.~~ **DONE** (PR #49)
4. ~~Reviewer: a claim isn't released on leaving the review screen (lease just expires after 15 min). With one reviewer, irrelevant — leave it.~~ **DONE** (PR #49)

C. For the age property + new types + deploy

- Age property: you already own the exact pattern — familyStem was the dress rehearsal. ageBand on lexeme (schema → migration → contract → LEXEME_OVERRIDE_FIELDS → Wortschatz filter/stats/editor), then thread it into pickForSkill/gen-items/gradeBand so band selection uses age ∩ frequency instead of frequency alone. Consider the counterpart on profile (grade/birth year) — unlockedUnit is currently doing double duty as an age proxy, and it's the weaker signal.
- New exercise/test types: the per-type cost is fixed and safe (Zod variant + solvability refinement + renderer + golden fixture + seed items — the drift gates catch everything). One warning learned this session: keep the wire schema non-strict-compatible-agnostic — the union already exceeds strict tool mode's limits, so solvability enforcement stays post-hoc; don't re-enable strict.
- Deploy checklist beyond infra: WEB_ORIGIN/REVIEWER_ORIGIN, STAFF_ADMIN_EMAILS, LLM_RESIDENCY_ACK, a real email provider (the service supports resend today — using Resend is less work than writing an SES adapter), S3 lifecycle rule for homework images.

D. Frontend engagement & retention (the centerpiece)

What exists: stars (flat +15), streak counter, threshold "league", week strip, heatmap, confetti, per-item praise, static buddy. What's missing is the daily loop and the relationship — and your own docs set the constraint correctly (calm feedback, no lives/energy/dark patterns), which for struggling readers is not just ethics, it's efficacy. Ranked by impact-per-effort:

1. ~~Bring the buddy to life (biggest lever, assets already paid for). monster-pets/ has four emotional states per mascot — the app ships only the static ones. Make Nepo/Stella react on /lernen: froehlich after today's session, ueberrascht on a unit unlock, gently traurig → "Nepo hat dich vermisst!" after absence. Companion attachment is the strongest retention mechanic for 6–9-year-olds, and it's a state-swap away.~~ **DONE** — `useBuddyState` hook + `buddyStateSrc`; all 4 states wired to live progress data (PR #51).
2. ~~A visible "today" goal. goalPerWeek exists but nothing shows today. A simple ring/checkmark on home ("Heute geübt ✓") + the week strip elevated next to it turns opening the app into completing something. The buddy closes the loop by celebrating the ring.~~ **DONE** — GoalCard with SVG ring + activity WeekStrip; "Heute geübt ✓" label (PR #54).
3. ~~Session-end forward hook. LessonComplete celebrates the past; add one line of future: "Morgen üben wir Wörter mit ie!" with the buddy looking expectant. Cheapest possible next-day pull.~~ **DONE** — forward hook card with buddy in cool state at LessonComplete bottom; buddy threaded from LessonRunner (PR #54).
4. ~~Kind streaks. Keep the counter, add one weekly "Streak-Joker" and a warm restart message instead of a zeroed number — punitive streaks demotivate exactly this audience.~~ **DONE** — flame hidden at 0, warm restart card, weekly joker (backend + frontend, PRs #52 + #53).
5. Badges — the SVG policy already reserves them and review_state already knows mastery: "Silben-Meister", 7-Tage-Serie, unit badges, shown in /profil. Medium effort (small backend addition).
6. Weekly parent email (highest leverage for your actual constellation). Retention at this age runs through the parent. digest.md already computes everything — a Friday "Mia hat 3× geübt, stark bei Silben, als Nächstes: Dehnungs-h" via the existing email service turns parents into the reminder system, without pushing notifications at a child.
7. ~~Rename /liga → "Erfolge". There are no peers; a threshold ladder posing as a league is the one slightly-dishonest mechanic in the app. Reframing it as personal achievements is more truthful and pairs with #5.~~ **DONE** — route, tab, heading, tier labels all updated (PR #52).
8. Later, with Polly: spoken praise variety — audio reward beats visual for pre-readers.

Deliberately not recommended: push notifications to the child, real leaderboards, time pressure, loss mechanics — all antagonistic to a remedial-literacy audience and to your stated values.

My suggested order: ~~B1+B2~~ ✓ → ~~D1~~ ✓ → ~~D4 + D7~~ ✓ → ~~D2 + D3~~ ✓ → **A2** with the deploy (Sentry + uptime) → D5/D6 after first user feedback.
