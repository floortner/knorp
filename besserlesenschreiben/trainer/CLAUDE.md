# CLAUDE.md

> Auto-loaded by Claude Code. **Read `./AGENTS.md` first**, then `../ARCHITECTURE.md`, then `./SPEC.md`.
> On any conflict, `../ARCHITECTURE.md` wins.

This folder is the **`-trainer` staff portal** of *besserlesenschreiben* — the internal tool
(~3 hand-provisioned staff, never shipped to families) for homework review, the learner directory,
and lecture assignment. It talks to the **staff realm only** (`/staff/*` routes, staff httpOnly
cookie — a family JWT never works here). **Desktop/tablet landscape, NOT mobile-first**, and the UI
copy is **emoji-free** — icons come from **lucide-react** only, used consistently.
