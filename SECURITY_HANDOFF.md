# Security work — handoff to local Claude Code (VS Code)

Pick-up notes for continuing the pre-beta security review on your MacBook. Written 2026-08-09.
Base commit at handoff: `main` @ `7911fd1` (PR #115 merged).

## TL;DR
The full-surface pre-beta security review is done and merged. **All P1, all P2, and every
content-independent P3 item are shipped to `main`** across three PRs (#80, #82, #115). What's left is
**two infra-only items** and a handful of **operator actions** — details below. The consolidated
findings live in `SECURITY_REVIEW.md`; the roadmap entry is `ROADMAP.md §G`; the tracker is GitHub
**issue #81**.

## First step on the MacBook
```bash
git checkout main && git pull origin main      # get #80/#82/#115
```
Optional: delete any stale `besserlesenschreiben/reviewer/` directory if it reappears — the staff portal
was renamed to `besserlesenschreiben/trainer/`; `reviewer/` is not tracked and not on `main`.

## Done and merged (do not redo)
- **P1 (#80):** parent-PIN reset now requires the current PIN; `blsb`→root deploy escalation closed;
  CloudFront + nginx security headers/CSP; JWT removed from the `/auth/verify` body.
- **P2 (#80):** SW-cache offline-logout bypass; telemetry-queue clear on logout; family login-code resend
  throttle; homework skill-tag bounds + sanitisation; child name dropped from the LLM digest; API bound to
  localhost in prod; backup dead-man's-switch.
- **P3 batch 1 (#82):** Swagger gated out of prod; `VITE_API_BASE` prod guard; `qc.clear()` on logout;
  `dnf-automatic` patching; systemd unit hardening; `sudo --preserve-env` in `release.sh`; CSRF note in
  ARCHITECTURE.
- **P3 batch 2 (#115):** homework-photo lifecycle by object tag (`class=homework`) + `s3:PutObjectTagging`;
  dedicated optional `IMAGE_TOKEN_SECRET`; email normalisation at both auth boundaries; 6-digit family
  login code (backend + `CodeScreen` UI/spec + SPEC).

## What's left — two infra items (each needs a `terraform apply` to verify)
Do these as **one new PR** off `main`. Both are content-independent.

1. **CloudWatch ops alarms → existing budget SNS topic** (`infra/`). Alarm on: EC2 `StatusCheckFailed`,
   the data-volume disk filling (Postgres dies on a full disk), and cert-renewal failure. The SNS topic
   already exists (`infra/budget.tf`). ~€0.
2. **GitHub deploy approval gate + SHA-pinned actions.** Put the deploy job in a GitHub **environment**
   with a required reviewer; scope the OIDC trust `sub` to `environment:beta` in `infra/iam.tf`; pin
   third-party actions in `.github/workflows/*` to commit SHAs. €0.

## Operator actions still pending (not code — you/Flo must do)
- **Run `terraform validate` + `plan` before any apply.** PR #115 changed the S3 lifecycle rule
  (prefix→tag) and added `s3:PutObjectTagging`; PR #80 added the CloudFront response-headers policy + the
  cloud-init/ownership changes. None were `terraform apply`'d from the review environment.
- **Smoke-test the CloudFront CSP in staging** before it fronts real traffic — a too-tight CSP fails
  closed. Confirm: family chat homework images render, the trainer queue renders, XHR to the API works.
- **Confirm `systemctl status blsb-api` is green after the next deploy** — the systemd hardening (P3
  batch 1) is config-only and unexercised; if a directive is too strict for the Node/Prisma runtime it
  surfaces there. `MemoryDenyWriteExecute` was deliberately omitted (Node JIT).
- **Backups (P2-7):** provision a **write-only** rclone token (B2/R2), leave `PRUNE_MIN_AGE` unset (use the
  provider's lifecycle rule), set `HEALTHCHECK_URL` in `/etc/blsb/backup.env`, enable `blsb-backup.timer`,
  run a restore drill. See `deploy/README.md`.
- **P2-4 taxonomy filter is dormant:** homework skill-tag enum-filtering activates automatically once
  `SKILL_TAGS` (`backend/src/contract/skills.ts`) is populated beyond `placeholder` in the §F content
  redesign. Re-verify homework focus tags flow correctly then.

## How to verify locally (this repo's gates)
Per-project, from each dir (`besserlesenschreiben/{backend,frontend,trainer}`):
```bash
npm ci            # backend; frontend/trainer use npm install
npx tsc --noEmit  # typecheck
npm test          # backend Vitest 214 · frontend 73 · trainer 41 at handoff
npm run lint
npm run build
```
Contract drift gates (run when a Zod contract changes):
```bash
# backend
npm run openapi:export && git diff --exit-code openapi.json
# frontend AND trainer (both type the FULL OpenAPI)
npm run gen:api && git diff --exit-code src/lib/api.gen.ts
```
Terraform isn't installed in the review env — validate/plan locally.

## Landmines learned this pass
- **The repo moves fast.** `main` advanced ~10 PRs during the review (assignments §H1/§H3, night-mode
  `appearance`, `GET /digest` removal, robust `time_ms` §J5, quick wins, the `reviewer/`→`trainer/`
  rename). **Re-verify each finding against current `main` before implementing** — the parent-PIN model
  referenced in older finding text is now an ownership-checked two-step confirmation, etc.
- **Both SPAs type the full OpenAPI**, so any backend contract change needs `gen:api` in **both**
  `frontend/` and `trainer/` or the drift gate fails red.
- **The 6-digit code touched the UI too** (`CodeScreen.tsx` hardcoded `LEN=4` + German copy) — when a
  contract constraint changes, grep the SPAs for hardcoded assumptions.
- **`api.gen.ts` is unaffected by `pattern`/`maxLength`/`maxItems`** — those don't change TS types, so the
  drift gate stays green even though `openapi.json` changes. Commit the regenerated `openapi.json` anyway.

## Suggested first prompt for the local session
> Read `SECURITY_REVIEW.md`, `ROADMAP.md §G`, and GitHub issue #81. All P1/P2/P3-content-independent items
> are merged (#80/#82/#115). Implement the two remaining §G infra items — CloudWatch ops alarms and the
> GitHub deploy approval gate + SHA-pinned actions — as one PR off `main`, but do NOT `terraform apply`;
> stop at `terraform plan` for me to review. Re-verify against current `main` first; the repo has moved.
