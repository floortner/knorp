# Lektions-Bibliothek

Dieses Verzeichnis ist die **einzige Quelle** für alle Lektionen der App: eine Markdown-Datei
pro Lektion in `lectures/`. Was hier auf dem `main`-Branch liegt, wird beim nächsten Deploy
automatisch in die App übernommen. Die Trainerinnen und Trainer weisen die Lektionen im
Trainer-Portal einzelnen Schülern zu — geschrieben werden sie hier.

Daneben liegt `linguist-contrib/`: der **Austauschordner zwischen der Inhalts-Seite (Angelika) und
Engineering**. Jede Lieferung
bekommt einen eigenen Unterordner (`iteration-1/` = der Developer-Handoff `lernapp3-opus.md` mit den
`BLS_*.html`-Kapitelplänen, die nächste Lieferung dann `iteration-2/` usw.); Engineerings
Rückmeldungen (`RUECKMELDUNG-ENGINEERING.md`) und erwartete Antworten wie `fertigkeiten.md` liegen
direkt im Ordner. Inhalte dort werden **nicht** von der App importiert — in die App kommt nur,
was als Lektionsdatei in `lectures/` liegt.

## Eine Lektion anlegen

1. Der einfachste Weg: in Claude Code den Befehl `/neue-lektion` verwenden — Claude kopiert die
   Vorlage `lectures/_vorlage.md`, füllt das Frontmatter aus und prüft. (Von Hand geht es genauso:
   die Vorlage zu `lectures/<name>.md` kopieren.)
2. Der **Dateiname ist der dauerhafte Name (Slug)** der Lektion: nur Kleinbuchstaben `a–z`,
   Ziffern und Bindestriche, z. B. `dehnungs-h-entdecken.md`. **Nachträglich nicht umbenennen** —
   der Name verbindet die Lektion mit der Lernstatistik der Schüler.
3. Fülle den `---`-Block (das „Frontmatter") aus — Referenz siehe unten.
4. Gib die Änderung mit `/abgeben` als Pull Request ab (Branch `content/<kurzbeschreibung>`,
   deutsche Beschreibung — nie direkt auf `main`). Die automatische Prüfung
   („CI") kontrolliert jede Datei und meldet Fehler auf Deutsch direkt am PR.
5. Nach dem Merge ist die Lektion beim nächsten Deploy in der App.

## Das Format

```yaml
---
title: "Dehnungs-h entdecken"        # Pflicht, max. 200 Zeichen
intro: >-                            # Pflicht, max. 300 Zeichen — der Merksatz.
  Merke: Das stumme h macht den      # Wird dem Schüler vor der ersten Aufgabe
  Selbstlaut davor lang.             # als Lernkarte gezeigt. Reiner Text.
status: published                    # optional: published (Standard) oder draft
exercises:                           # 1–12 Aufgaben, in dieser Reihenfolge
  - id: eh-erkennen-1                # Pflicht — dauerhafte ID, siehe Regeln unten
    type: placeholder                # Aufgabentyp (derzeit nur: placeholder)
    prompt: "Welches Wort hat ein Dehnungs-h?"   # die Frage, max. 2000 Zeichen
    options: ["fahren", "fallen"]    # 2–8 Antwortmöglichkeiten
    answer: "fahren"                 # muss exakt einer der options sein
    praise: "Super, genau richtig!"  # Lob nach richtiger Antwort, max. 200 Zeichen
    skills: [placeholder]            # 1–10 Skill-Tags aus der festen Taxonomie
    difficulty: 1                    # optional: 1 (Standard) bis 3
---

Der Bereich unter dem Frontmatter ist für zukünftige Erklärtexte reserviert und wird
derzeit nicht in der App angezeigt.
```

## Regeln

- **Slugs und Aufgaben-IDs niemals umbenennen.** Sie sind der Anker für die Lernstatistik:
  über sie sehen die Trainer, wie ein Schüler eine Aufgabe letzte Woche beantwortet hat —
  auch nachdem die Aufgabe überarbeitet wurde. Eine umbenannte ID gilt als „gelöscht + neu"
  und trennt die Historie.
- **Inhalt ändern ist ausdrücklich erlaubt** (auch quer über viele Lektionen in einem PR).
  Beim Deploy entsteht eine neue Version der Lektion; bereits zugewiesene Übungen behalten
  exakt den Stand, den der Schüler bekommen hat.
- **`skills` kommen aus der festen Taxonomie** (`backend/src/contract/skills.ts` bzw.
  `skills.lock.json` hier im Verzeichnis). Ein neuer Skill-Tag ist eine Engineering-Änderung —
  bitte ansprechen, nicht einfach ein neues Wort erfinden.
- **`status: draft`** = die Lektion erscheint im Trainer-Portal, kann aber noch nicht
  zugewiesen werden. Ohne Angabe gilt `published`.
- Dateien mit `_` am Anfang (z. B. `_vorlage.md`) werden ignoriert.
- Sprachliche Konvention der App: die Nutzer heißen **Schüler** (nie „Kinder").

## Prüfung lokal

Wer das Repository lokal hat, kann jederzeit prüfen:

```bash
cd besserlesenschreiben/backend && npm run content:validate
```

Dieselbe Prüfung läuft automatisch bei jedem PR.
