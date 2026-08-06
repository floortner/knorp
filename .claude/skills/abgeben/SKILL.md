---
name: abgeben
description: Fertige Änderungen in content/ als Pull Request abgeben — prüfen, Branch, Commit, Push, PR-Beschreibung auf Deutsch. Für die Inhalts-Arbeit (Angelika).
---

Reiche die aktuellen Änderungen unter `content/` als Pull Request ein. Halte dich an
`content/CLAUDE.md`.

1. Prüfe mit `git status`, dass **nur** Dateien unter `content/` geändert sind. Sind
   andere Dateien dabei: anhalten, auf Deutsch erklären und Flo fragen lassen —
   nichts verwerfen.
2. Führe `cd besserlesenschreiben/backend && npm run content:validate` aus; bei
   Fehlern zuerst beheben.
3. Erstelle von `main` aus einen Branch `content/<kurzbeschreibung>`, committe die
   Änderungen mit deutscher Commit-Nachricht und pushe den Branch. Niemals direkt auf
   `main` committen oder pushen, kein Force-Push.
4. Erstelle mit `gh pr create` einen Pull Request mit deutschem Titel und einer
   kurzen deutschen Beschreibung (welche Lektionen, was geändert).
5. Nenne den PR-Link und erkläre in einem Satz: Flo prüft und merged, danach ist die
   Änderung beim nächsten Deploy in der App.
