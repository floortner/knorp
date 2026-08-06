---
name: neue-lektion
description: Eine neue Lektion in content/lectures/ anlegen — Vorlage kopieren, Frontmatter ausfüllen, auf Deutsch prüfen. Für die Inhalts-Arbeit (Angelika).
---

Lege eine neue Lektion an. Halte dich an `content/CLAUDE.md` und das Format in
`content/README.md` (beide zuerst lesen, falls noch nicht geschehen).

1. Das Thema kommt aus den Argumenten; fehlt es, frage auf Deutsch nach Thema und
   grober Aufgabenidee.
2. Schlage einen Slug vor (Kleinbuchstaben, Ziffern, Bindestriche) und weise darauf
   hin, dass er dauerhaft ist. Prüfe, dass er in `content/lectures/` noch nicht
   existiert.
3. Kopiere `content/lectures/_vorlage.md` nach `content/lectures/<slug>.md` und fülle
   das Frontmatter mit den Inhalten — `status: draft`, solange nichts anderes gesagt
   wird.
4. Prüfe mit `cd besserlesenschreiben/backend && npm run content:validate`; erkläre
   und behebe Fehler.
5. Zeige die fertige Lektion zum Gegenlesen und erinnere daran, dass `/abgeben` sie
   als Pull Request einreicht.
