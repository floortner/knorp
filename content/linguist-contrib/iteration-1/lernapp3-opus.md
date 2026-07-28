# BLS-Lernapp — Developer Handoff

> **Stand:** Juli 2026 · **Autorin Pädagogik:** Mag. Angelika Ortner · **Produkt:** besserlesenschreiben.at  
> **Tech Stack (bestehend, nicht ändern):** Vite/React Frontend · Node.js Backend · PostgreSQL · bestehendes API-Contract  
> **Entwicklungstool:** Claude Code

---

## 1. Architektur-Überblick

### Zwei Ebenen — Kapitelplan ≠ App

| Ebene | Zweck | Sichtbar für |
|-------|-------|-------------|
| **📋 Kapitelplan (Trainerin-Handbuch)** | Alle pädagogischen Erklärungen, Dialoge zwischen Dr. Zucchini & Nepomuk, didaktische Begründungen | Trainerin/Therapeutin |
| **📱 App (Kind-Erlebnis)** | Schlank, Duolingo-Stil. Übung → Feedback → Weiter. Nur Nepomuk als Begleiter | Kind (8–16 J.) |

**Konsequenz für die Implementierung:** Dr. Zucchini existiert nur in den HTML-Kapitelplänen als Dokumentation. Im React-Frontend taucht ausschließlich **Nepomuk** auf.

### Figuren

- **🟠 Nepomuk** — einziger Begleiter in der App. Auf Augenhöhe mit dem Kind. Gibt kurze Tipps nach Fehlern.
- **🥒 Dr. Zucchini** — nur im Trainerin-Handbuch / Kapitelplan. Nicht in der App.

---

## 2. Duolingo-Prinzipien (verbindlich für alle Übungen)

| # | Prinzip | Umsetzung |
|---|---------|-----------|
| ① | **Erst machen, dann verstehen** | Übung startet sofort, kein Intro-Text. Regeln entstehen durch Muster. |
| ② | **Vorgelöstes erstes Beispiel** | Erstes Item jeder Übung zeigt die Lösung visuell (nicht als Text). |
| ③ | **Feedback ist die Erklärung** | Richtig → ✓ + kurzer Satz. Falsch → ✗ + Erklärung in einem Satz. Nepomuk-Tipp bei Fehler. |
| ④ | **Wiederholung statt Erklärung** | Dasselbe Wort kommt in verschiedenen Formaten: hören → tippen → zuordnen → im Satz. |
| ⑤ | **Kleine Portionen** | 5–8 Aufgaben pro Lektion, ca. 2–3 Minuten. Progress-Bar oben. |
| ⑥ | **Nepomuk als Mini-Coach** | Erscheint nur bei Fehler oder Steckenbleiben. Kurz, ein Satz. |
| ⑦ | **🌱 Beiläufig einführen** | Neues Konzept taucht 2–3 Übungen vorher im Feedback auf, bevor es explizit geübt wird. |

---

## 3. Visuelles System

### Kugel-System (Kern der App)

| Element | Darstellung | Bedeutung |
|---------|-------------|-----------|
| **Buchstabenkugel** | Runde Kugel mit Buchstabe | 1 Laut = 1 Kugel |
| **Kerni** | Gelbe Kugel (🟡) | Selbstlaut = Kern jeder Silbe |
| **☆ (leerer Stern)** | Sternförmige Extra-Kugel | Extra-Buchstabe für Sprachrhythmus (kurz/lang) |
| **Kleine Kerni-Kugel** | Kleinere gelbe Kugel | Schwa-e in unbetonten Endungen (-en, -el, -er, -e) |

### CI-Farben

```
Teal:       #6EBCAE
Gold:       #F5CD4A
Coral:      #E5915C
Magenta:    #BB3B85
Dunkelgrün: #2F4B43
Font:       Lato
```

### Übungsstufen-Farbcodierung

| Stufe | Farbe | Badge-CSS |
|-------|-------|-----------|
| **Rezeptiv** (erkennen, zuordnen) | 🟢 Grün | `background:#e3f5ea; color:#2a9e5e` |
| **Analytisch** (zerlegen, Muster) | 🔵 Blau | `background:#eef4fc; color:#3a6aa8` |
| **Produktiv** (selbst bilden) | 🟠 Orange | `background:#fff5f0; color:#E5915C` |

---

## 4. Übungstypen — React-Komponenten

Aus allen Kapiteln ergeben sich **wiederkehrende Übungstypen**, die als wiederverwendbare React-Komponenten gebaut werden sollten:

### Typ 1: `MultipleChoice` — Laut/Wort hören → Button wählen

```
Props:
  audioSrc: string           // Audio-Datei (Wort oder Laut)
  options: string[]           // 4-6 Antwort-Buttons
  correctIndex: number        // Index der richtigen Antwort
  feedbackCorrect: string     // Nepomuk-Text bei richtig
  feedbackWrong: string       // Nepomuk-Text bei falsch
  presolvedFirst: boolean     // Erstes Item vorgelöst?

Verwendet in:
  Kap 1: E1 (Welchen Laut hörst du?)
  Kap 1: E3 (Ausrufe — welcher Selbstlaut?)
  Kap 1: F3 (Wort hören — welchen Selbstlaut?)
  Kap 8: E2 (Klingt der Reim kurz oder lang?)
  Kap 10: B4/C4/D5 (Welche ☆ hat die Familie?)
```

### Typ 2: `SortIntoBuckets` — Wörter/Bilder in Kategorien ziehen

```
Props:
  items: { text: string, emoji?: string, category: string }[]
  buckets: { id: string, label: string, color: string }[]
  feedbackPerItem: boolean
  summaryAtEnd: boolean

Verwendet in:
  Kap 1: F5 (Wörter sortieren — a/e/i/o/u Spalten)
  Kap 8: E4 (Kurz/Lang sortieren)
  Kap 10: A1/B1/C1/D1/E1 (Wortfamilien sortieren)
  Kap 10: D5c (Bilder zuordnen — MIT h / OHNE h)
```

### Typ 3: `FindTheOddOne` — Störer finden

```
Props:
  words: string[]            // 4-5 Wörter, eines gehört nicht dazu
  oddIndex: number
  feedbackCorrect: string
  feedbackWrong: string
  explanation: string         // Warum der Störer nicht passt

Verwendet in:
  Kap 10: A3/B3/C3/D3/E3 (Welches gehört nicht dazu?)
  Kap 9: V2 (Welches Verb ist falsch?)
```

### Typ 4: `FillTheGap` — Lücke im Wort/Satz füllen

```
Props:
  sentence: string            // Satz mit ___
  options: string[]           // 2-4 Auswahlmöglichkeiten
  correctIndex: number
  feedbackCorrect: string
  feedbackWrong: string

Verwendet in:
  Kap 8: E7c (ie oder i?)
  Kap 9: E3 (Welche Endung passt?)
  Kap 9: V3 (Vorsilbe in den Satz einsetzen)
  Kap 10: E4b (s, ss oder ß?)
  Kap 10: F3 (ä oder e? äu oder eu?)
```

### Typ 5: `MarkInWord` — Buchstabe/Silbe im Wort antippen

```
Props:
  word: string
  targetIndices: number[]     // Welche Buchstaben sollen markiert werden
  highlightColor: string      // z.B. Kerni-Gelb
  feedbackCorrect: string
  feedbackWrong: string

Verwendet in:
  Kap 1: F4 (Selbstlaut markieren)
  Kap 9: E11 (Wo ist die Silbengrenze?)
  Kap 10: A2/B2/C2/D2/E2 (Wortstamm finden)
```

### Typ 6: `DragAndOrder` — Elemente in richtige Reihenfolge bringen

```
Props:
  pieces: { id: string, text: string, type: 'prefix'|'stem'|'suffix' }[]
  correctOrder: string[]
  resultWord: string

Verwendet in:
  Kap 9: E7 (Silben-Herzen ordnen)
  Kap 10: A5 (Wortbausteine ordnen)
  Kap 10: A6/B7/C7/D7/E7 (Puzzlesteine kombinieren)
```

### Typ 7: `CheckboxDecision` — Bedingungen prüfen und entscheiden

```
Props:
  word: string
  conditions: { label: string, correct: boolean }[]
  resultLabel: string         // z.B. "Dehnungs-h?"
  feedbackCorrect: string
  feedbackWrong: string

Verwendet in:
  Kap 10: D5b (Dehnungs-h Bedingungen prüfen)
```

### Typ 8: `CatchFalling` — Fallende Buchstaben/Wörter fangen (Gamification)

```
Props:
  items: { text: string, isTarget: boolean }[]
  speed: number               // Steigerung pro Runde
  rounds: number
  feedbackHit: string
  feedbackMiss: string

Verwendet in:
  Kap 1: E0 (Meteoritenschauer)
  Kap 1: F2 (Selbstlaute fangen)
```

### Typ 9: `PairMatching` — Verbinden / Zuordnen

```
Props:
  pairs: { left: string, right: string }[]
  feedbackCorrect: string

Verwendet in:
  Kap 7: E1/E3 (Reimwörter verbinden)
  Kap 10: B8 (Nomen + Adjektiv verbinden)
  Kap 10: F4 (Verwandte Wörter verbinden)
```

### Typ 10: `WriteWord` — Wort hören/sehen und eintippen

```
Props:
  audioSrc?: string           // Wort wird vorgesprochen
  displayWord?: string        // Wort wird gezeigt (dann verdeckt)
  showHint: boolean           // Hilfe-Button: Wort nochmal zeigen
  feedbackCorrect: string
  feedbackWrong: string
  acceptedAnswers: string[]   // Varianten die akzeptiert werden

Verwendet in:
  Kap 9: E16 (Schreibsilben einprägen — schreiben)
  Kap 10: Ü9-Ü11 (MORPHEUS Wörter schreiben 1-3)
  Kap 10: A2/B2 (Wortstamm eintippen)
```

---

## 5. Kapitel-Übersicht mit Übungen

### Kapitel 1 — Vorlauf (Selbstlaute)

**Lernziel:** Selbstlaute (a, e, i, o, u) sicher erkennen und von Mitlauten unterscheiden.  
**Wortschatz:** Einsilbig, streng lautgetreu. Keine Umlaute, kein Schwa, keine Doppelung.

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| E0 | Meteoritenschauer — Buchstaben fangen | CatchFalling | rezeptiv | vorhanden ✅ |
| E1 | Welchen Laut hörst du? | MultipleChoice | rezeptiv | zu bauen |
| E2 | Mundbilder — welcher Laut passt? | MultipleChoice | rezeptiv | zu bauen |
| E3 | Ausrufe — welcher Selbstlaut? | MultipleChoice | rezeptiv | zu bauen |
| F1 | Labyrinth — nur über Selbstlaute | Custom (Grid) | analytisch | zu bauen |
| F2 | Selbstlaute fangen — Tempo | CatchFalling | analytisch | zu bauen |
| F3 | Wort hören — welchen Selbstlaut? | MultipleChoice | produktiv | zu bauen |
| F4 | Wort sehen — Selbstlaut markieren | MarkInWord | produktiv | zu bauen |
| F5 | Wörter sortieren — a/e/i/o/u | SortIntoBuckets | produktiv | zu bauen |

**Feedback-Beispiele (Nepomuk):**
- Richtig: „Genau! Bei A ist der Mund weit offen und die Stimme kommt frei heraus!"
- Falsch: „Hm, probier nochmal — hör genau hin: kommt die Stimme frei heraus?"
- Selbstlaut vs. Mitlaut: „👄 Selbstlaut: Mund offen, Stimme frei. 🤐 Mitlaut: knallt, zischt, brummt."

---

### Kapitel 7 — Reime

**Lernziel:** Reimpaare erkennen, Reimmuster = gleiches Wortende.

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| E1 | Reimwörter verbinden — Bilder | PairMatching | rezeptiv | vorhanden ✅ |
| E2 | Reimwörter hören & zuordnen | MultipleChoice | rezeptiv | vorhanden ✅ |
| E3 | Geschriebene Reimwörter verbinden | PairMatching | analytisch | vorhanden ✅ |
| E4 | Reimwörter im Satz | FillTheGap | produktiv | vorhanden ✅ |
| E5 | Reimfamilien sammeln | WriteWord | produktiv | zu bauen |

---

### Kapitel 8 — Sonderkugeln (kurz/lang, ☆)

**Lernziel:** Kurze und lange Reime/Vokale unterscheiden. Die ☆ (Extra-Kugel) als Marker für kurz/lang verstehen.  
**Wichtig:** „Der Reim klingt kurz oder lang" — nie den Vokal isoliert analytisch beschreiben.

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| E1 | Kurz oder lang? — Forscher-Übung | MultipleChoice | rezeptiv | vorhanden ✅ |
| E2 | Klingt der Reim kurz oder lang? | MultipleChoice | rezeptiv | vorhanden ✅ |
| E3 | Welches Wort klingt kurz? | MultipleChoice | rezeptiv | vorhanden ✅ |
| E4 | Kurz/Lang sortieren | SortIntoBuckets | analytisch | vorhanden ✅ |
| E5 | Gleicher Selbstlaut, verschiedener Reim | MultipleChoice | analytisch | vorhanden ✅ |
| F1 | Braucht das Wort eine Extra-Kugel? | MultipleChoice | analytisch | vorhanden ✅ |
| F2 | Wie viele Kugeln schreibst du? | Custom | analytisch | vorhanden ✅ |
| F3 | Kurz/Lang + Mitlautkugeln | MultipleChoice | analytisch | vorhanden ✅ |
| F4 | ie oder i? | FillTheGap | produktiv | vorhanden ✅ |
| F5 | Welche Extra-Kugel macht den Kerni lang? | MultipleChoice | analytisch | vorhanden ✅ |
| F6 | Reimwörter — Klang verrät Schreibung | Custom | analytisch | vorhanden ✅ |
| F7 | Sortieren: kurz/lang + ☆ | SortIntoBuckets | analytisch | vorhanden ✅ |
| F8 | Doppelungs-Reimwörter | Custom | produktiv | vorhanden ✅ |
| F9 | Falsche Zwillinge — Minimalpaare | FillTheGap | produktiv | vorhanden ✅ |
| F10 | Fantasiewörter richtig lesen | Custom | produktiv | vorhanden ✅ |

---

### Kapitel 9 — Schreibsilben

**Lernziel:** Wörter in Schreibsilben zerlegen. Endungen (-en, -el, -er, -e). Vorsilben (ver-, vor-, ab-, …). Komposita verlängern.

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| E1 | Wie viele Schreibsilben? | MultipleChoice | rezeptiv | vorhanden ✅ |
| E2 | Finde Wörter mit -el/-en/-er | SortIntoBuckets | rezeptiv | vorhanden ✅ |
| E3 | Welche Endung passt? | FillTheGap | rezeptiv | vorhanden ✅ |
| E4 | Kleine Kerni-Kugel einsetzen | MarkInWord | analytisch | vorhanden ✅ |
| E5 | Silbenspirale — zerlegen | DragAndOrder | analytisch | vorhanden ✅ |
| E5b | Silbenspirale — selber | DragAndOrder | analytisch | vorhanden ✅ |
| E6 | Silben-Störer | FindTheOddOne | analytisch | vorhanden ✅ |
| E7 | Silben-Herzen ordnen | DragAndOrder | analytisch | vorhanden ✅ |
| E8 | Silben-Tabelle | Custom | analytisch | vorhanden ✅ |
| E9 | Fehlerwörter in Schreibsilben | WriteWord | produktiv | vorhanden ✅ |
| E10 | Silbe hören + finden | MultipleChoice | analytisch | vorhanden ✅ |
| E10b | Betonte Silbe schreiben | WriteWord | produktiv | vorhanden ✅ |
| E11 | Wo ist die Silbengrenze? | MarkInWord | analytisch | vorhanden ✅ |
| E12 | Welche ☆ an der Grenze? | MultipleChoice | analytisch | vorhanden ✅ |
| E13 | Schreibsilben zusammensetzen | DragAndOrder | produktiv | vorhanden ✅ |
| E14 | Kurz/Lang Silbe für Silbe | MultipleChoice | analytisch | vorhanden ✅ |
| E15 | Minimalpaar-Brücke | PairMatching | produktiv | vorhanden ✅ |
| E15b | Doppelte Mitlaute an Grenze | FillTheGap | produktiv | vorhanden ✅ |
| E16 | Schreibsilben einprägen — schreiben | WriteWord | produktiv | vorhanden ✅ |
| V1 | Welche Vorsilbe passt? — ___gehen | FillTheGap | rezeptiv | vorhanden ✅ |
| V2 | Welches Verb ist falsch? | FindTheOddOne | analytisch | vorhanden ✅ |
| V3 | Vorsilbe in den Satz einsetzen | FillTheGap | produktiv | vorhanden ✅ |
| K1 | Verlängern bei Verben | FillTheGap | analytisch | vorhanden ✅ |
| K2 | Silben verbinden & konjugieren | DragAndOrder | analytisch | vorhanden ✅ |
| K3 | Komposita mit Doppelung | MultipleChoice | analytisch | vorhanden ✅ |
| K4 | Komposita verlängern | PairMatching | produktiv | vorhanden ✅ |

---

### Kapitel 10 — Wortfamilien (MORPHEUS-Aufbau)

**Lernziel:** Wortstamm erkennen. Vorsilbe + Stamm + Nachsilbe zerlegen. Die ☆ vererbt sich in der Wortfamilie.  
**Aufbau:** 6 Unterkapitel (A–F), gestaffelt nach Rechtschreibbesonderheit. Jedes mit rezeptiv → analytisch → produktiv.

#### A · Lauttreue Wortstämme (keine ☆)

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| A1 | Wortfamilien sortieren | SortIntoBuckets | rezeptiv | zu bauen |
| A2 | Wortstamm finden | WriteWord | rezeptiv | zu bauen |
| A3 | Störer finden | FindTheOddOne | rezeptiv | zu bauen |
| A4 | Wortbausteine zählen | MultipleChoice | analytisch | zu bauen |
| A5 | Wortbausteine ordnen | DragAndOrder | analytisch | zu bauen |
| A6 | Puzzlesteine kombinieren | DragAndOrder | produktiv | zu bauen |
| A7 | Nachsilbe → Wortart | SortIntoBuckets | analytisch | zu bauen |
| A8 | Wortrallye | Custom (Path) | produktiv | zu bauen |

**🌱 Beiläufig in A1–A3:** Feedback zeigt Wortbausteine: „✓ verkaufen — ver + kauf + en" → bereitet A4 vor.

#### B · Doppelung ☆

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| B1 | Wortfamilien sortieren (Doppel) | SortIntoBuckets | rezeptiv | zu bauen |
| B2 | Wortstamm finden (Doppel) | WriteWord | rezeptiv | zu bauen |
| B3 | Störer finden (Doppel) | FindTheOddOne | rezeptiv | zu bauen |
| B4 | Welche ☆? — Doppelung | MultipleChoice | analytisch | zu bauen |
| B5 | In Tabelle zerlegen | DragAndOrder | analytisch | zu bauen |
| B6 | Deep-Dive „fall" | WriteWord | analytisch | zu bauen |
| B7 | Puzzlesteine (Doppel) | DragAndOrder | produktiv | zu bauen |
| B8 | Nomen + Adjektiv verbinden | PairMatching | produktiv | zu bauen |

#### C · ie ☆

Gleiche Struktur wie B, mit ie-Wortstämmen: FLIEG, LIEB, LIEG, SPIEL, WIED(ER), WIEG.  
8 Übungen (C1–C8), zu bauen.

#### D · Dehnungs-h ☆

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| D1–D3 | Sortieren, Stamm finden, Störer | wie oben | rezeptiv | zu bauen |
| D4 | Buchstabe nach h (l/m/n/r) | MultipleChoice | analytisch | zu bauen |
| D5 | Welche ☆? — Dehnungs-h | MultipleChoice | analytisch | zu bauen |
| D5b | Bedingungen prüfen (Checkboxen) | CheckboxDecision | analytisch | **gebaut ✅** |
| D5c | Bilder zuordnen MIT/OHNE h | SortIntoBuckets | rezeptiv | **gebaut ✅** |
| D6–D8 | Tabelle, Puzzlesteine, sammeln | wie oben | analytisch/produktiv | zu bauen |

**Dehnungs-h Regeln (Entscheidungsbaum):**
- ✅ **Ja:** Langer Kerni + danach l, m, n, r
- ❌ **Nein:** Kurzer Kerni · Zwielaute (au, ei, eu/äu) · davor Sch, Sp, t, Qu, Kr, Gr

#### E · S-Schreibung ☆

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| E1–E3 | Sortieren, Stamm finden, Störer | wie oben | rezeptiv | zu bauen |
| E4 | ss oder ß? | FillTheGap | analytisch | zu bauen |
| E4b | s, ss oder ß? (Wortfamilie) | FillTheGap | analytisch | **gebaut ✅** |
| E5–E8 | Welche ☆, Tabelle, Puzzlesteine, Deep-Dive | wie oben | analytisch/produktiv | zu bauen |

**S-Schreibung Regeln:**
- ss und ß können **wechseln** in einer Wortfamilie (schließen → schloss → geschlossen)
- s **bleibt immer s** (lesen → las → gelesen)

#### F · Gemischt + Anwenden

| ID | Übung | Typ | Stufe | Status |
|----|-------|-----|-------|--------|
| F1 | Gemischt — welche ☆? | MultipleChoice | produktiv | zu bauen |
| F2 | Rätselhaftes ä — Stammwort finden | WriteWord | produktiv | zu bauen |
| F3 | ä oder e? äu oder eu? | FillTheGap | produktiv | zu bauen |
| F4 | Verwandte Wörter verbinden | PairMatching | produktiv | zu bauen |
| F5 | Unsicheres Wort — frag die Familie | WriteWord | produktiv | zu bauen |
| F6 | Fehlerwörter korrigieren | WriteWord | produktiv | zu bauen |
| F7 | Adjektiv → Nomen (-heit/-keit) | WriteWord | produktiv | zu bauen |
| F8 | Verkleinerungsform (-chen + Umlaut) | WriteWord | produktiv | zu bauen |

---

## 6. Wortmaterial — MORPHEUS Wortstämme

### Stufe 1 — Lauttreu (22 Stämme)
BOD, GEB/GAB, GEH/GANG, HAUS, HOL, HÖR, LAD, LAUF, LAUT, LEB, LES, NÄCH/NAH, RAD, RUF, SAG, SEH/SICHT, TAG, TAT/TUN, TEIL, WEG, WEIT, ZEUG

### Stufe 2 — Lauttreu, komplexer (49 Stämme)
BERG, BIND, BLEIB, BRAUCH, BRING, BUCH, DENK/DACH, END, FERN, FIND/FUND, FORM, FRAG, FREI, FREU/FREUD, GLEICH, GRUND, HALT, HAND, HELF, HOCH, JUNG, KIND, KLEIN, LAND, LANG, LUFT, MACH, MERK, NACHT, RICHT, SCHAU, SCHEID/SCHIED, SCHLAF, SCHLAG, SCHNEID, SCHÖN, SCHREI, SCHREIB, SCHUL, SING, SPRECH/SPRACH, SPRING/SPRUNG, STADT, STEIG/STIEG, STUND, SUCH, TRAG/TRUG, WERF/WURF, WORT

### Doppelung (15 Stämme)
BRENN/BRANN, DECK, FALL/FIEL, FÜLL, HERR, KOMM/KAM, MANN, MITT, PLATZ, RENN/RANN, SCHNELL, SCHWIMM, SITZ/SETZ/SATZ, STELL, TREFF

### ie (6 Stämme)
FLIEG/FLUG, LIEB, LIEG/LEG, SPIEL, WIED(ER), WIEG/WICHT

### Dehnungs-h (11 Stämme)
NAH/NÄCH, BAHN, FAHR/FUHR, FEHL, KEHR, LEHR, NEHM/NAHM, UHR, WOHN, ZAHL, ZAHN

### S-Schreibung (17 Stämme)
BESS, ESS/Aß, FASS, FLIEß/FLOSS/FLUSS, FUß, GROß, GRUß, HEIß, KLASS, MESS/MAß, REIß/RISS, SCHLIEß/SCHLOSS, SCHLUSS, STOß, STRAß, WASS, WISS/WUSS

### Vorsilben
AB, AN, AUF, BE, ER, GE, NACH, UN, VER, VOR, VOLL, WIEDER

### Nachsilben (→ bestimmen Wortart)
- **Nomen:** -UNG, -HEIT, -KEIT, -NIS, -TUM, -SCHAFT, -SAL, -ER
- **Adjektive:** -LICH, -IG, -ISCH, -SAM, -BAR, -LOS
- **Verben:** -EN, -T, -ER(N)

---

## 7. Datenmodell-Empfehlung

```sql
-- Kapitel
chapters (id, number, title, description, color)

-- Übungen innerhalb eines Kapitels
exercises (
  id, chapter_id, exercise_code,  -- z.B. "A1", "D5b"
  title, description,
  exercise_type,                   -- 'multiple_choice', 'sort_buckets', 'find_odd', etc.
  difficulty_level,                -- 'rezeptiv', 'analytisch', 'produktiv'
  sort_order,
  status                           -- 'built', 'todo'
)

-- Einzelne Aufgaben/Items pro Übung
exercise_items (
  id, exercise_id,
  item_data JSONB,                 -- Flexibel: Audio, Optionen, korrekte Antwort, Feedback
  sort_order,
  is_presolved                     -- Erstes Item vorgelöst?
)

-- Feedback-Texte
feedback_templates (
  id, exercise_id,
  trigger,                         -- 'correct', 'wrong', 'hint', 'end'
  character,                       -- 'nepomuk'
  text
)

-- Fortschritt pro Kind
user_progress (
  user_id, exercise_id,
  completed_at, score, attempts
)
```

---

## 8. Audio-Anforderungen

- **Sprache:** Österreichisches Hochdeutsch
- **Aktuell:** Web Speech API (Platzhalter)
- **Ziel:** Professionelle Aufnahmen (Sprecher/Sprecherin)
- **Benötigt für:** Alle Hör-Übungen (E1, E2, F3 in Kap 1; Reime in Kap 7; kurz/lang in Kap 8; alle „Wort hören" Aufgaben)
- **Format:** MP3 oder OGG, kurze Clips (einzelne Wörter + Sätze)

---

## 9. Konzentrationsspanne (Grolimund/Keller)

| Alter | Max. Konzentration |
|-------|-------------------|
| 5–7 J. | 15 Min. |
| 7–10 J. | 20 Min. |
| 10–12 J. | 25 Min. |
| 12–16 J. | 30 Min. |

**Faustregel:** Alter × 2 = Minuten

**Konsequenz:** App-Lektionen max. 2–3 Minuten, 5–8 Items. Training-Session max. 15–20 Min. mit Methodenwechsel.

---

## 10. Quelldateien (HTML-Prototypen)

Die folgenden HTML-Dateien enthalten die vollständigen Kapitelpläne mit allen Dialogen, Übungsbeschreibungen und teilweise gebauten interaktiven Übungen:

| Datei | Inhalt |
|-------|--------|
| `BLS_Kapitel1_Vorlauf.html` | Kapitel 1 — Selbstlaute (Duolingo-Style umgebaut) |
| `BLS_Kapitel7_Reime.html` | Kapitel 7 — Reime |
| `BLS_Kapitel8_Sonderkugeln.html` | Kapitel 8 — Sonderkugeln (kurz/lang, ☆) — umfangreichste Datei |
| `BLS_Kapitel9_Schreibsilben.html` | Kapitel 9 — Schreibsilben, Vorsilben, Komposita |
| `BLS_Kapitel10_Wortfamilien.html` | Kapitel 10 — Wortfamilien (MORPHEUS-Aufbau, 6 Unterkapitel) |
| `BLS_Designprinzipien.html` | Gesamtkonzept, Duolingo-Prinzipien, MORPHEUS, Terminologie |
| `BLS_MORPHEUS_Wortstämme.html` | 120 Wortstämme nach Schwierigkeitsstufe |
| `BLS_Einstufungstest.html` | Eingangsdiagnostik (2 Tests: Trainerin + Eltern) |
| `BLS_Diagnostikdiktate.html` | Quellensammlung Diagnostik (JTeS, SLRT-II, RST 4–7) |

**Gebaute interaktive Übungen** (HTML/JS, direkt spielbar in den Dateien):
- Kapitel 8: ca. 15 Übungen
- Kapitel 9: ca. 25 Übungen
- Kapitel 10: E4b (ss/ß), D5b (Dehnungs-h Bedingungen), D5c (Bilder MIT/OHNE h)

---

## 11. Priorisierung

1. **Sofort:** React-Komponenten für die 10 Übungstypen bauen (wiederverwendbar)
2. **Dann:** Kapitel 1 komplett implementieren (9 Übungen, einfachstes Kapitel, guter Testfall)
3. **Dann:** Kapitel 8 migrieren (meiste gebaute Übungen, größter Prototyp-Wert)
4. **Parallel:** Audio-Pipeline aufsetzen (TTS als Platzhalter → echte Aufnahmen später)
5. **Danach:** Kapitel 7, 9, 10 schrittweise
