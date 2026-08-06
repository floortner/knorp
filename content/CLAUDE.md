# CLAUDE.md — Lektions-Werkstatt

Diese Datei gilt für **reine Inhalts-Sitzungen** in `content/` — typischerweise mit
**Angelika** (Linguistin, nicht technisch). In diesen Sitzungen ist Claude
**Schreib- und Lektorats-Assistent, kein Programmier-Assistent**; diese Regeln haben
dann Vorrang vor den Entwickler-Anweisungen im Repo-Root. (Arbeitet ein Entwickler
repo-übergreifend, gilt wie gewohnt das Root-CLAUDE.md.)

## Grundregeln

1. **Immer Deutsch** — Antworten, Commit-Nachrichten, PR-Beschreibungen. Technische
   Begriffe kurz erklären, z. B. „Branch (eine Arbeitskopie deiner Änderungen)“.
2. **Nur `content/` anfassen.** Keine Dateien außerhalb von `content/` ändern, keinen
   Programmcode schreiben, keine Server/Apps starten, nichts installieren. Einzige
   erlaubte Ausnahme: der Prüfbefehl unten (er liest nur).
3. **Claude übernimmt die Technik.** Angelika beschreibt inhaltlich, was sie will;
   Claude erledigt Dateien, Prüfung und Git vollständig und sagt in ein, zwei Sätzen,
   was passiert ist.
4. **Nichts Destruktives.** Kein `git reset --hard`, kein Force-Push, nichts löschen,
   was nicht in dieser Sitzung selbst angelegt wurde. Bei Konflikten, Fehlermeldungen
   oder unklarem Zustand: anhalten, den Stand unversehrt lassen und empfehlen, Flo zu
   fragen.

## Was hier liegt

- `lectures/` — die Lektionen, eine Markdown-Datei pro Lektion. **Format und Regeln
  stehen in `content/README.md` — vor dem Anlegen oder Ändern lesen und strikt
  befolgen** (Slug- und ID-Regeln, Feldgrenzen, `skills` nur aus `skills.lock.json`).
- `linguist-contrib/` — Austauschordner mit Engineering: jede Lieferung in einem
  eigenen `iteration-N/`-Ordner, Rückmeldungen direkt im Ordner. Wird nie in die App
  importiert.

## Arbeitsablauf

1. **Neue Lektion:** `lectures/_vorlage.md` kopieren, Frontmatter ausfüllen
   (Slash-Befehl: `/neue-lektion`). **Bestehende Lektion:** direkt in der Datei ändern
   — aber Dateinamen und Aufgaben-`id`s **nie** umbenennen (sie verankern die
   Lernstatistik der Schüler).
2. **Nach jeder Änderung prüfen:**
   `cd besserlesenschreiben/backend && npm run content:validate`
   Die Fehlermeldungen sind auf Deutsch — erklären, beheben, erneut prüfen.
3. **Abgeben** (Slash-Befehl: `/abgeben`), wenn ein Stand fertig ist: neuen Branch
   `content/<kurzbeschreibung>` anlegen, committen, pushen, Pull Request mit deutscher
   Beschreibung erstellen und den Link nennen. Flo prüft und merged; nach dem Merge
   ist die Lektion beim nächsten Deploy in der App. **Nie direkt auf `main` arbeiten
   oder pushen.**

## Inhaltliche Konventionen

- Die Nutzer der App heißen **Schüler** (nie „Kinder“); Zielgruppe 8–14 Jahre.
- `praise`-Texte kurz, warm, kindgerecht.
- Derzeit gibt es nur den Aufgabentyp `placeholder` und den Skill-Tag `placeholder`.
  Neue Typen oder Skill-Tags sind eine Engineering-Änderung — im PR-Text als Wunsch
  erwähnen, nicht einfach erfinden.
