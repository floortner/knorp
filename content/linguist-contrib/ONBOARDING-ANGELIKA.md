# Onboarding Angelika — Lektionen selbst schreiben mit Claude Code

Stand: 06.08.2026. Ziel: Angelika arbeitet selbstständig an den Lektionen in `content/` —
auf Deutsch, ohne Technik-Wissen, getrennt vom App-Code. Claude Code übernimmt Dateien,
Prüfung und Abgabe; Flo prüft am Ende jede Änderung, bevor sie in die App kommt.

## Vorbereitung (Flo, vorab)

- [x] Setup gemerged (PR #99, 06.08.): `content/CLAUDE.md`, Slash-Befehle `/neue-lektion` +
      `/abgeben`, Berechtigungs-Voreinstellungen.
- [ ] GitHub-Konto von Angelika erfragen bzw. anlegen lassen; als Collaborator einladen:
      Repo → Settings → Collaborators → Add people → Rolle **Write**.
      (Schutz von `main` ist schon aktiv: sie kann nur über Pull Requests liefern, Flo merged.)
- [ ] Claude-Konto für Angelika klären: eigenes Konto mit Claude-Code-Zugang (z. B. Pro),
      kein geteilter Login.

## Arbeitsumgebung — gemeinsam entscheiden

**Variante A (empfohlen): Claude Code im Browser** — claude.ai/code, mit dem GitHub-Repo
verbinden. Nichts zu installieren, Prüfung und Pull Requests laufen in der Cloud.

**Variante B: Claude-Code-App am Rechner.** Dann zusätzlich nötig: git, Node und die
GitHub-Kommandozeile `gh` (einmal `gh auth login`), das Repo einmal klonen, und einmalig
`npm ci` in `besserlesenschreiben/backend`, damit die Lektionsprüfung lokal läuft.

## Erste gemeinsame Sitzung (~30 Minuten)

1. Repo in Claude Code öffnen; Angelika schreibt einfach auf Deutsch, was sie möchte.
2. Einmal den ganzen Weg gehen: `/neue-lektion` → Ergebnis gemeinsam lesen →
   `/abgeben` → Flo merged den Pull Request → Lektion nach dem nächsten Deploy in der App zeigen.
3. Kontrollieren: Claude antwortet auf Deutsch und fasst nur `content/` an. Falls nicht: die
   Sitzung neu beginnen und als erste Nachricht schreiben: „Wir arbeiten nur an den Lektionen
   in content/“. (Claude Code immer im Repo-Stammverzeichnis starten, nicht im Unterordner
   `content/` — sonst schlägt der Prüfbefehl fehl.)
4. Merksatz für den Alltag: **„Schreib auf Deutsch, was du willst; Claude macht die Technik;
   am Ende `/abgeben` — Flo bekommt es zum Prüfen.“**

## Nachgelagert (Flo, optional)

- [ ] CI-Job `content` als Pflicht-Check auf `main` einrichten, damit ein PR mit roter
      Lektionsprüfung nicht gemerged werden kann — vorher prüfen, dass der Job bei **jedem**
      PR läuft (ein Pflicht-Check, der nicht startet, blockiert den PR dauerhaft).

## Nachschlagen

- Regeln für Claude in Inhalts-Sitzungen: `content/CLAUDE.md`
- Lektions-Format und Autorenregeln: `content/README.md`
