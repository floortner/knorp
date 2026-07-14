# Security Review — besserlesenschreiben (pre-beta)

**Date:** 2026-07-14 · **Scope:** backend (`-api`), family frontend (`-web`), reviewer portal (`-review`), and the AWS `infra/` + `deploy/` layer. **Context:** solo developer, going beta on AWS (single EC2 + nginx + self-hosted Postgres + S3/CloudFront), handling children's data (GDPR-sensitive).

## Verdict

This is a **disciplined, well-built codebase** and the beta topology is sound. The hard things are done correctly: two-realm auth separation with distinct signing keys enforced at boot, per-request account-status revocation, `user_id`/`profile_id` sourced only from the JWT, durable PIN lockout, argon2 hashing, enumeration-resistant signup, S3 keys always scoped to the caller's prefix, a pseudonymised staff queue, EXIF-stripping upload transcode, the homework draft-vs-authoritative gate, honest error envelopes, and clean logging. IAM is genuinely least-privilege, there's no SSH (SSM only), no static AWS keys (GitHub OIDC scoped to repo+ref), IMDSv2 required, and secrets never enter Terraform state.

There is **one finding that defeats an intended security property** (the parent-PIN reset bypass) and **one root-privilege-escalation chain** in the deploy scripts. Everything else is defense-in-depth hardening. Nothing here should block beta for more than a day or two of fixes.

Findings were produced by four focused reviewers and the load-bearing ones re-verified by reading the source directly.

---

## Priority 1 — fix before beta

### P1-1 · Parent PIN can be reset without knowing it (parental-control bypass) — Medium
`backend/src/modules/parent/parent.controller.ts:20-26` + `parent.service.ts:26-34`

`POST /parent/set-pin` sits behind only the global family `JwtAuthGuard` — **not** `ParentScopeGuard` — and `setPin()` overwrites `parentPinHash` unconditionally, clearing the lockout, with no check of the current PIN. Anyone holding the family session (in practice **the child, on the family's own logged-in device**) can call `set-pin {pin:"0000"}`, then `verify-pin`, then `unlock-next` / `reset` / `reset-chat`. The PIN is the gate on exactly those destructive routes, and it's bypassable by the actor it exists to stop. The durable 5-try/15-min lockout is moot — you don't guess the PIN, you replace it.

**Fix:** allow the free first-time set only when `parentPinHash` is null; once a PIN exists, require either the current PIN (add a `currentPin` field verified in `setPin`) or a fresh `parent`-scope token to change it.

### P1-2 · `blsb` → root privilege escalation via root-executed, blsb-writable files — High
`deploy/release.sh:37`, `deploy/blsb-backup.service:8`, `infra/cloud-init.sh.tftpl:88`

`release.sh` does `chown -R blsb:blsb "$RELEASE_DIR"`, which includes `deploy/` — so `backup.sh` becomes owned by the unprivileged app user. `blsb-backup.service` then runs that file **as root** on a timer. Any code-execution as `blsb` (an npm postinstall, a Node/Nest bug on the multipart/LLM path) can rewrite `backup.sh` and get root at the next timer fire — reading `/etc/blsb/env` (all JWT secrets + the Anthropic key), the whole DB, and the backup credentials. This defeats the otherwise-careful root/blsb split.

**Fix:** install root-owned copies of the scripts/units (`install -m 755 -o root -g root deploy/backup.sh /usr/local/sbin/blsb-backup.sh` and point the unit there); `chown` only the backend build dir, not `deploy/`; make `/opt/blsb/releases` root-owned.

### P1-3 · No CSP or security headers on any of the three hostnames — Medium
`infra/cdn.tf` (both distributions, no `response_headers_policy_id`), `deploy/nginx-api.conf.template` (no `add_header`), both `index.html` files

No CSP, no HSTS, no `X-Content-Type-Options`, no `frame-ancestors`, no `Referrer-Policy` anywhere. There are no HTML-injection sinks in the code today (verified — see below), so this is defense-in-depth, but it's the single control that would contain a *future* mistake (a markdown chat renderer, an inlined SVG, a compromised dependency exfiltrating data). The reviewer portal in particular renders adversarial-derived content (vision-OCR'd homework drafts) and drives identity-bearing admin actions. `Referrer-Policy` also keeps presigned-URL query strings out of `Referer` headers.

**Fix:** add one `aws_cloudfront_response_headers_policy` and attach it to both distributions; add HSTS via nginx `add_header` (both apps are fully self-contained — fonts are npm-bundled, no CDN scripts — so a tight CSP like `default-src 'self'; script-src 'self'; frame-ancestors 'none'` is realistic). Attaching AWS's managed `SecurityHeadersPolicy` is the one-line version.

### P1-4 · `/auth/verify` returns the 30-day session JWT in the JSON body — Medium
`backend/src/contract/models.ts:13` (`verifyResponseSchema` includes `token`), returned at `auth.controller.ts:44`

The whole auth design is "no token in JS, httpOnly cookie, `/me` probe" — yet verify hands the full 30-day JWT to JavaScript at the moment it's minted. The SPA ignores it, but any script-context compromise (future XSS, malicious extension, a stray logging hook) can read a long-lived credential that works from anywhere, defeating the reason the cookie is httpOnly.

**Fix:** delete `token` from `verifyResponseSchema` (keep `isNewAccount`), re-run `openapi:export` + `gen:api`. The frontend already never reads it — pure deletion. Keep it only if a non-browser client genuinely needs it, in which case gate it.

---

## Priority 2 — soon after beta

### P2-1 · Service-worker cache defeats logout offline and retains child data — Medium
`frontend/vite.config.ts:21-33` (Workbox `NetworkFirst` on `/me`, `/units`, `/progress`, 24h) + `AuthProvider.tsx:22-30` (logout clears cookie + `['me']` query only, never `caches`)

`/me` (child names, streaks) and `/progress` persist in Cache Storage for 24h and are never evicted on logout. Two consequences: (1) on a shared/family device, the last user's profile is readable from Cache Storage after logout; (2) **offline logout bypass** — after logout, reloading while offline resets in-memory `signedOut`, the `/me` probe fails over to the cached 200, and `RequireAuth` renders the previous user's app.

**Fix:** in `logout()` (and the `onUnauthorized` handler) add `if ('caches' in window) await caches.delete('blsb-api');` — closes both halves. Consider excluding `/me` (the auth probe) from runtime caching entirely.

### P2-2 · Telemetry queue keeps child answers in localStorage (48h) and survives logout — Low
`frontend/src/lib/telemetry.ts:14-16,82-86`; body includes `prompt`/`expected`/`given` (`attempts.dto.ts:9-19`)

Literal answer text sits in plaintext `localStorage` (`blsb.attempts.queue`), not cleared on logout, and `flushAttempts()` runs at startup/on `online` — so attempts queued under account A get POSTed with account B's cookie after an account switch (backend rejects the foreign `sessionId`, but the cross-account send still happens). **Fix:** `localStorage.removeItem('blsb.attempts.queue')` in `logout()`.

### P2-3 · Family login-code requests have no per-address resend throttle — Low/Medium
`backend/src/modules/auth/auth.service.ts:46-58`

The **staff** flow throttles code emails to one per address per 60s; the **family** flow doesn't — every call to an active email mints a new code and sends mail, bounded only by the blunt 10/min per-IP limiter. One IP can send ~600 code emails/hour to a victim's inbox (SES cost + spam + churns the victim's current code). Not a takeover vector (the attacker never sees the code), but an email-bomb/cost issue. **Fix:** mirror the staff throttle — skip issuing if a still-fresh unconsumed code exists for the address.

### P2-4 · Homework analysis skill tags written to the scheduler unvalidated — Low/Medium
`backend/src/contract/staff.ts:27-32`, applied at `review.service.ts:290-316`

`suggestedFocus`/`errorType` are unbounded `z.string()` with no taxonomy allow-list. On approval they're written verbatim into `attempt.skillTags` / `reviewState.skillTag` — unlike LLM *exercises*, which are validated against `SKILL_TAGS`. A hallucinated or image-injected tag becomes a permanent scheduling key that maps to no drillable content and later surfaces in `digest.md` sent to the LLM. **Fix:** validate against `SKILL_TAG_SET` at apply time (drop unknowns) and bound array/string lengths in the schema.

### P2-5 · Child's real first name is sent to Anthropic in the LLM prompt — Medium (privacy)
`backend/src/services/digest/digest.render.ts:124`, fed to the prompt at `sessions.service.ts:210,223`

The digest header carries the child's real first name into the session-generation prompt, though the name plays no role in generation (the system prompt forbids greetings). More minor PII than necessary reaches a third-party processor — the kind of field a DPA review flags for a children's product. **Fix:** drop `name` (or use the pseudonym `handle`) from the digest header; update the golden intentionally. Client-side personalization can stay.

### P2-6 · Bind the backend to `127.0.0.1` in production — Low
`backend/src/main.ts:98` (`host: '0.0.0.0'`), vs `deploy/blsb-api.service` which states "binds :3000 on localhost"

Only the security group stands between the internet and raw port 3000, and it's the **default VPC**. Anything reaching :3000 directly bypasses nginx's `X-Forwarded-For` overwrite; with `trustProxy: true` a caller could then spoof `X-Forwarded-For: 127.0.0.1` and hit the rate-limiter's loopback exemption. Defended today at two layers (nginx overwrites XFF, SG opens only 80/443) but one SG misedit from exposure. **Fix:** bind `127.0.0.1` when `NODE_ENV=production` (one line). Also gate the loopback rate-limit exemption to non-production so the e2e-only carve-out can't matter in prod.

### P2-7 · Backups are destructible from the box, opt-in, and silent on failure — Medium
`deploy/backup.sh:22-28`, `deploy/blsb-backup.service`, `deploy/README.md`

The on-box rclone credential needs **delete** rights (for the prune step), so rooting the box (P1-2) wipes the DB *and* every backup at once. Setup is a manual README step (easy to run live with zero backups), and the service has no `OnFailure=` / dead-man's-switch, so months of failed backups go unnoticed. **Fix:** use a write-only bucket token + provider lifecycle rules for pruning (Backblaze B2 / R2 support this); add a free healthchecks.io ping as the last line of `backup.sh`; install the timer from `release.sh` so a rebuilt box can't silently lose it.

---

## Priority 3 — hardening backlog (cheap, do as time permits)

- **OS patching story** — `infra/cloud-init.sh.tftpl` installs nothing like `dnf-automatic`; the internet-facing box would run unpatched. Add `dnf install -y dnf-automatic && systemctl enable --now dnf-automatic.timer` with `apply_updates = yes`. Also drop the `|| true` swallowing certbot install failures. (€0)
- **GitHub deploy = root-RCE-by-design, no approval gate** — `infra/iam.tf:156-172` + `deploy.yml`. Put deploy jobs in a GitHub **environment** with a required reviewer and scope the OIDC `sub` to `environment:beta`; pin third-party actions to commit SHAs. (€0)
- **6-digit family login code** — `auth.service.ts:49` uses `randomInt(1000,10000)` (9,000-code space, no leading zeros) vs staff's 6-digit. Well-bounded by the 5-try cap, but the asymmetry is free to remove.
- **Normalize emails** (`trim().toLowerCase()`) at the auth boundary — `auth.service.ts:30,35` / `staff-auth.service.ts` use raw DTO email while `seed.ts` lowercases, so `User@x.com` can create a duplicate pending account and a mixed-case staff login can miss.
- **Swagger/OpenAPI served publicly in prod** — `main.ts:86-95`, no `NODE_ENV` gate. Free recon surface; wrap in `if (NODE_ENV !== 'production')`.
- **systemd unit hardening** — `deploy/blsb-api.service` has `NoNewPrivileges`/`ProtectSystem=full`/`PrivateTmp`; add the cheap rest (`ProtectHome`, `ProtectKernel*`, `RestrictSUIDSGID`, `RestrictAddressFamilies`, `CapabilityBoundingSet=`, `SystemCallFilter=@system-service`). Skip `MemoryDenyWriteExecute` (Node JIT).
- **Operational alarms** — nothing alerts on instance status-check failure, the 20 GB data volume filling (a full disk takes Postgres down), cert-renewal failure, or auth abuse. Two CloudWatch alarms + a healthcheck ping to the existing budget SNS topic. (~€0)
- **Blob lifecycle** — `infra/storage.tf:29-42` expires *everything* under `users/` at 90 days, but that prefix also holds digests/session blobs. Scope the rule to the `…/homework/` key segment.
- **`VITE_API_BASE` prod fallback** — `frontend`/`reviewer` `lib/api.ts` silently fall back to `http://localhost:3000`; a build without the env var ships a broken plaintext-http artifact. Throw when `import.meta.env.PROD && !VITE_API_BASE`.
- **react-query cache on logout** — both apps' `logout()` remove only `['me']`/`['staff-me']`; chat history and (reviewer) real emails linger in memory. Use `qc.clear()`.
- **PWA update prompt not wired** — `vite.config.ts` sets `registerType:'prompt'` but nothing imports `virtual:pwa-register`, so updated clients keep running the old bundle (and any future security fix) until all tabs close. Wire `useRegisterSW`.
- **Dedicated image-token secret** — `storage.service.ts:38` reuses `STAFF_JWT_SECRET` to HMAC image-capability tokens (dev path only; prod uses S3 presigning). A separate secret avoids cross-purpose key reuse.
- **Values on `sudo` command lines** (`deploy/release.sh:49-50`) are visible in `ps` — benign today (passwordless socket DSN) but breaks the moment a password lands in `DATABASE_URL`. Use `--preserve-env` with exported vars.

---

## Verified and done well (calibration)

- **Auth realms:** distinct secrets enforced at boot (`env.ts:83`), family guard rejects `aud:'staff'`, staff guard requires it, cookies have distinct names *and* paths so the browser never cross-sends. Per-request status re-read in both guards → deactivate/delete is immediate, not at token expiry.
- **Id-from-JWT discipline:** every `profileId` from body/param is a selector run through `assertProfileOwned` before use; the parent token binds `profileId` at verify-pin so destructive routes never read a child id from the request. `POST /attempts` derives `profileId` from the session row, not the body.
- **Storage:** keys always `users/{account}/{profile}/…` from JWT ids; S3 via IAM instance role (no keys in env); presigned GETs per-object; account/profile deletion erases blobs. Dev image endpoint is HMAC-capability-gated and can't be path-traversed.
- **Uploads:** MIME allow-list, 10 MB + single-file cap, sharp transcode to WebP with EXIF dropped, dimension cap, malformed images 422 not crash.
- **Draft-vs-authoritative gate holds:** `llm_analysis` never mutates the profile; only staff `review.submit` applies `reviewedAnalysis`, guarded against double-apply; family sees only the authoritative result when `reviewed`.
- **No raw SQL** anywhere (zero `$queryRaw`/`$executeRaw`/`Unsafe`); everything parameterized through Prisma.
- **Error envelope** scrubs 5xx to `INTERNAL`; no Prisma/provider internals or stack traces leak. **Logging** logs identifiers + outcomes only — no answers, emails, codes, PINs, JWTs, presigned URLs, or bodies; pino redacts `authorization`/`cookie`.
- **Zero HTML-injection sinks** in either frontend (no `dangerouslySetInnerHTML`/`innerHTML`/`eval`); all LLM/user/OCR content renders through React escaping as text nodes. SVGs are static self-hosted assets via `<img src>` with whitelisted IDs. Image URLs land only in `<img src>`, never `href`.
- **Test/debug backdoors hard-gated:** `EMAIL_PROVIDER=capture` + `/test/last-login-code` fail closed unless `NODE_ENV=test`; dev seed accounts double-gated on `SEED_DEV_ACCOUNTS=true` and non-prod.
- **CSRF:** `SameSite=Lax` httpOnly cookies + one-registrable-domain subdomains + explicit prod CORS allowlist (boot fails if empty) is an adequate no-token posture for beta. Residual: SameSite is the *only* CSRF control, so XSS on a sibling subdomain (e.g. the marketing site) is same-site — worth a note in ARCHITECTURE; a CSRF token can wait.
- **LLM cost abuse bounded** by per-profile daily caps on chat + sessions, 1000-char chat cap, and the per-IP limiter — even though ★ endpoints are free.
- **Infra:** no SSH (SSM only), Postgres unix-socket peer-auth (not in the SG, no password), no static AWS keys (OIDC scoped to repo+ref, fork PRs can't deploy), least-privilege IAM (no `s3:*`/`ssm:*` wildcards), S3 public-access-blocked + SSE + OAC, IMDSv2 required, EBS encrypted, secrets as SecureString kept out of TF state, budget hard-cap stop-action, client-side `age`-encrypted off-AWS backups.

---

## Suggested order for a solo dev

1. **P1-1** (PIN reset) and **P1-4** (drop `token` from verify) — small backend changes, close the two "intended property defeated" gaps.
2. **P1-2** (root-exec chain) — ~1h in `release.sh` + units; the only real privilege escalation.
3. **P1-3** (headers policy) + **P2-1**/P2-2 (`caches.delete` + clear telemetry on logout) — one Terraform resource and a few one-liners, batchable into one PR.
4. **P2-3**…**P2-7** as capacity allows; **P2-7** (survivable backups) is the one that decides whether you recover from the incident that makes you need them.
5. P3 backlog opportunistically; the disk-full alarm and `dnf-automatic` are the two most likely to save an outage.
