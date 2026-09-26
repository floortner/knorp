# knorp — besserlesenschreiben

Adaptive German literacy tutor for students aged 8–14: a family PWA, an API backend, and an internal
trainer portal for professional homework review. Free to use; access is approved by staff.

| Where | What |
|---|---|
| [`besserlesenschreiben/`](besserlesenschreiben/README.md) | The three apps — backend (`-api`), family app (`-web`), trainer portal (`-trainer`) — and `ARCHITECTURE.md`, the governing doc |
| [`content/`](content/README.md) | The lecture library: one markdown file per lecture, authored by the linguist, validated in CI, imported at deploy (guide in German) |
| [`e2e/`](e2e/README.md) | Playwright user journeys over family app + backend (run locally, not in CI) |
| [`infra/`](infra/README.md) · [`deploy/`](deploy/README.md) | AWS beta deployment (Terraform) and the on-box release scripts |
| [`assets/`](assets/README.md) · `website/` | Brand + mascot masters; the static marketing page |
| [`ROADMAP.md`](ROADMAP.md) · [`HISTORY.md`](HISTORY.md) | What's next · what shipped, with the pivot log |

**Status:** built through the beta deployment; the beta is paused since 2026-09-12 (resume runbook in
`infra/README.md`). Developed with Claude Code — `CLAUDE.md` is the always-loaded guide.
