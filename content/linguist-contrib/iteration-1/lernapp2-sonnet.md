# BLS-Lernapp — Erweiterung: Sonderkugeln & Kurz/Lang-Modul

**Zweck dieses Dokuments:** Content- und Feature-Spezifikation für die Erweiterung der bestehenden BLS-Lernapp um zwei neue didaktische Bausteine: die **schwierigen Buchstabenkugeln** (Zwielaute, Muster, Verwandten-Brücke) und die **Kurz/Lang-Systematik** (Doppelkonsonant, Dehnung, Reimwörter). Richtet sich an den Entwickler zur Umsetzung mit Claude Code.

**Tech-Stack (fix, nicht verändern):** Vite/React-Frontend, Node.js-Backend, bestehender API-Contract, PostgreSQL-Datenbank. Diese Spec beschreibt **Content-Modell und Interaktionsverhalten**, keine Architektur — Einordnung ins bestehende Schema liegt beim Entwickler.

---

## 1. Referenz-Prototypen (bereits gebaut, als Verhaltens-Blaupause)

Vier HTML-Prototypen wurden als Vanilla-JS-Einzeldateien gebaut, um Interaktionsverhalten und Content-Struktur zu demonstrieren. Sie sind **keine Produktionscode-Vorlage**, sondern zeigen das gewünschte UX-Verhalten:

| Prototyp | Zeigt |
|---|---|
| `BLS_Kapitel_SchwierigeBuchstabenkugeln.html` | Kapitel-Ablauf: 3 Übungen × 4 Stufen, Nepo/Dr.-Zucchini-Sprechblasen, Forscher-Abzeichen |
| `BLS_Uebung_KurzOderLang.html` | Bildpaare (kurzes Wort antippen) + Sortier-Raster (rot/blau) |
| `BLS_Uebung_Reimwoerter.html` | Zwei-Tap-Modell (hören → auswählen) + Schriftbild-Stufe mit TTS |
| `Die schwierigen Buchstabenkugeln – *.docx` | Vollständige Content-Pakete je Übung (Lernziel, Stufen, Sprechblasen) |

Alle Dateien liegen im Projekt-Output und sollten dem Entwickler mitgegeben werden.

---

## 2. Didaktisches Fundament: die Kugel-Systematik

Die App nutzt eine wiederkehrende Metapher: **Buchstabenkugeln**. Jeder Laut ist normalerweise eine Kugel (1 Laut = 1 Zeichen). Der Wortkern (Selbstlaut/Umlaut) heißt **Kerni**.

### 2.1 Die vier Sonderkugel-Typen

Wenn Hören allein nicht zur richtigen Schreibung führt, tritt **Dr. Zucchini** als Meta-Signal auf:

| Typ | Beschreibung | Beispiel |
|---|---|---|
| **Verschmolzene Kugel** | Zwielaut: zwei Zeichen, ein Laut. Nur au/eu/ei — nicht jedes Vokalpaar verschmilzt. | Haus, Eule, Ei |
| **Muster-Kugel** | Festes Schreibmuster, nur am Wortanfang | qu (kw), sp (schp), st (scht) |
| **Sternkugel** | Geschrieben, aber nicht (einzeln) gehört | Doppelkonsonant, ck/tz, Dehnungs-ie/h, Auslaut-d |
| **Blasse Kugel** | Kaum hörbare Endung | -en (nicht Teil dieser Erweiterung) |

Die **Verwandten-Brücke** (ä/äu über verwandtes Wort ableiten, z. B. Baum→Bäume) ist **kein Kugel-Typ**, sondern ein Werkzeug.

### 2.2 Kurz/Lang ist keine Kugel, sondern eine Eigenschaft

Kurz/lang wird nicht als Kugel-Typ behandelt, sondern als **Markierung der Vokalkugel selbst** (rot = kurz, blau = lang — durchgängige Farbkonvention). Diese Markierung ist die **vorhersagende Weiche**: Der gehörte Klang sagt voraus, welche Schreibung folgt.

```
Wortkern hören
      │
      ├── kurz (rot) ──→ 2 Mitlautkugeln danach: gleich oder verschieden?
      │                    ├── gleich       → Doppelkonsonant (Sternkugeln)
      │                    └── verschieden  → beide normal schreiben, KEIN Doppel
      │
      └── lang (blau) ─→ welche Dehnung?
                           ├── ie
                           ├── Dehnungs-h
                           ├── Doppelvokal (aa/ee/oo)
                           └── keine extra Kugel (Vokal einfach, ungekennzeichnet)
```

**Sternchen-Prinzip (durchgängige visuelle Markierung):**
- Kurz: die **zwei Mitlautkugeln nach dem Kerni** bekommen das Sternchen, wenn sie gleich sind (Doppelkonsonant-Signal).
- Lang: **ein stummer Mitschreiber** bekommt das Sternchen — das e nach dem i (ie), das h, oder der zweite Vokal (aa/ee/oo).
- Bei „keine extra Kugel" gibt es **kein Sternchen** — der Vokal wird geschrieben, wie er klingt.

Diese Sternchen-Logik sollte als **Content-Flag pro Buchstabe/Silbe** modelliert werden (siehe Datenmodell unten), nicht hart in die UI-Komponente codiert, damit sie in Zwielaut-, Doppelkonsonant- und Dehnungs-Übungen konsistent wiederverwendbar ist.

---

## 3. Content-Module

### 3.1 Modul „Die schwierigen Buchstabenkugeln" (3 Übungen)

Jede Übung hat 4 Stufen und 2 Übungstypen (A = rezeptiv/produktiv, B = Manipulation), siehe `Die schwierigen Buchstabenkugeln – Übungskapitel.docx` für vollständige Sprechblasen-Texte je Stufe.

#### Übung 1 — Zwielaut-Kugeln (eu, ei, au)

| Stufe | Zielbaustein | Aufgabentyp |
|---|---|---|
| 1 | eu | Bild-Zettel antippen |
| 2 | ei | Bild-Zettel antippen / einfüllen |
| 3 | au | Bild-Zettel antippen |
| 4 | eu/ei/au gemischt | richtigen Zwielaut einfüllen |

- **Typ A:** Raster aus Bild-Zetteln, Kind tippt nur die mit Zielbaustein an.
- **Typ B:** Zwei Einzelkugeln (z. B. e + u) werden per Drag zusammengezogen → Verschmelzungs-Animation zur Zwielaut-Kugel.
- **Distraktoren Stufe 4:** verdrehte Paare (ua, ao) als Stolpersteine — testen das Prinzip „nicht alle Kernis verschmelzen".

#### Übung 2 — Zucchinis Rezeptbuch (qu, sp, st)

| Stufe | Zielmuster | Lautschreibung (Distraktor) |
|---|---|---|
| 1 | qu | kw |
| 2 | sp | schp |
| 3 | st | scht |
| 4 | gemischt | Wort-Reparatur (z. B. „Kwark" → „Quark") |

- **Typ A:** Bild + Lückenwort, Muster ergänzen.
- **Typ B:** Falsch (lautgetreu) geschriebenes Wort wird repariert.
- **Wichtige Regel:** sp/st-Muster gilt nur am Wortanfang (Wespe, Fenster sind KEINE Fälle).

#### Übung 3 — Die Verwandten-Brücke (ä, äu)

| Stufe | Ableitung | Beispiel |
|---|---|---|
| 1 | ä erkennen | ä-Wörter im Satz finden |
| 2 | a → ä | Hand → Hände |
| 3 | au → äu | Baum → Bäume |
| 4 | äu vs. eu (Fangfall) | Feuer hat keinen au-Verwandten → eu |

- **Typ A:** Einzahlwort muss zuerst gefunden werden, bevor die Mehrzahl-Lücke im verwandten Wort freigeschaltet wird (erzwingt die Strategie).
- **Typ B:** Entscheidung anhand Verwandten-Suche.
- **Merkfälle (kein Brücken-Wort vorhanden):** Bär, Käse, Käfer, Märchen — separates Merkwort-Modul, nicht in dieser Übung.

### 3.2 Modul „Kurz oder lang?" (Vokaldauer-Training)

Zweistufig pro Aufgabenblock:
1. **Bildpaare:** zwei Bilder nebeneinander, Kind wählt das kurz klingende Wort.
2. **Sortier-Raster:** Bilder einzeln antippen, Zuordnung rot (kurz) / blau (lang) — Tap toggelt zwischen den Zuständen, bei korrekter Zuordnung wird die Karte gesperrt („locked").

Kein Feedback-Bestrafung bei Fehlversuchen — nur Fortschritt bei Treffern zählen (konsistent mit Fokus-Brille-Prinzip aus anderen Kapiteln).

### 3.3 Modul „Reimwörter" (Kernstück der Erweiterung)

**Interaktionsmodell (aus Prototyp übernehmen):**

- **Stufe 1 (Bilder/Hören), Zwei-Tap-Pattern:**
  1. Tap auf Bild → Wort wird per TTS vorgelesen, Bild erhält „gehört"-Zustand (visuell z. B. gold umrandet)
  2. Zweiter Tap auf dasselbe Bild → Wertung: gehört das Wort zur Reimgruppe? Richtig → grün/Häkchen; falsch → kurzer Shake, Zustand zurückgesetzt, erneut anhörbar
  - Wichtig: **kein Text unter den Bildern** — nur Bild + Ton, damit das Kind über den Klang arbeitet, nicht über die Schrift.

- **Stufe 2 (Schriftbild):**
  - Anlaut abgesetzt vom Reim, Reim farbig hervorgehoben (Reimfarbe konsistent mit kurz/lang-Codierung: rot bei kurzen Reimen, blau bei langen).
  - Automatisches Vorlesen der ganzen Reimkette beim Einblenden der Stufe; jede Zeile zusätzlich einzeln antippbar zum Nachhören.
  - Format: `[Anlaut]·[Reim]`, z. B. `S·onne`, `Br·ief`.

**TTS-Hinweis:** Prototyp nutzt `window.speechSynthesis` (Web Speech API, `de-DE`) als Platzhalter. Für Produktion: geprüft werden sollte, ob die App bereits eine Audio-Asset-Pipeline hat (eingesprochene Wörter statt System-TTS) — Datenmodell unten sieht pro Wort ein `audioKey`-Feld vor, das entweder auf eine Audiodatei oder einen TTS-Fallback-Text zeigt.

**Reimgruppen — nur einsilbige Wörter, vollständige Content-Liste:**

| Kategorie | Reim | Anker | weitere Reimwörter |
|---|---|---|---|
| kurz · 2 gleiche Mitlautkugeln | -all | Ball | Hall, Wall |
| kurz · 2 gleiche Mitlautkugeln | -ock | Rock | Stock, Block |
| kurz · 2 gleiche Mitlautkugeln | -ett | Bett | nett, fett |
| kurz · 2 verschiedene Mitlautkugeln | -ind | Kind | Wind, sind, Rind |
| kurz · 2 verschiedene Mitlautkugeln | -erz | Herz | Sterz, Terz |
| kurz · 2 verschiedene Mitlautkugeln | -ark | Park | Mark, stark, Quark |
| lang · ie | -ief | Brief | tief, schief |
| lang · ie | -ieb | Dieb | lieb, Sieb |
| lang · Dehnungs-h | -ahn | Zahn | Bahn, Hahn |
| lang · Doppelvokal aa | -aar | Haar | Paar |
| lang · Doppelvokal ee | -ee | See | Klee, Schnee |
| lang · Doppelvokal oo | -oot / -oos | Boot | Moos |
| lang · keine extra Kugel | -ut | gut | Blut, Mut |
| lang · keine extra Kugel | -ot | rot | tot, Brot |
| lang · keine extra Kugel | -ag / -ad | Tag | mag, Rad, Pfad |

> **Hinweis zur Wortauswahl:** „Terz" und „Sterz" sind fachlich korrekt reimend, aber selten — mit Angelika gegenlesen, ob sie für die Zielgruppe (8–14 J.) beibehalten werden. Alle anderen Wörter sind gebräuchlich.

---

## 4. Vorgeschlagenes Content-Datenmodell

Dies ist ein **Vorschlag für die Content-JSON-Struktur**, die ins bestehende DB-Schema/API übersetzt werden muss — keine Vorgabe für Tabellennamen o. ä., das entscheidet der Entwickler passend zum bestehenden Contract.

```jsonc
{
  "exerciseType": "reimwoerter",
  "chapter": "kurz-lang",
  "groups": [
    {
      "id": "all-kurz",
      "category": "kurz-gleich",       // kurz-gleich | kurz-verschieden | lang-ie | lang-h | lang-doppelvokal | lang-keine-kugel
      "rime": "all",
      "vowelLength": "short",          // short | long
      "anchor": {
        "word": "Ball",
        "onset": "B",
        "audioKey": "ball",
        "imageKey": "ball"
      },
      "words": [
        { "word": "Hall", "onset": "H", "audioKey": "hall", "imageKey": "hall", "isRhyme": true },
        { "word": "Wall", "onset": "W", "audioKey": "wall", "imageKey": "wall", "isRhyme": true }
      ],
      "distractors": [
        { "word": "Baum", "onset": null, "audioKey": "baum", "imageKey": "baum", "isRhyme": false }
      ],
      "starMarker": {
        "type": "doubled-consonant",   // doubled-consonant | none | ie-e | dehnungs-h | second-vowel
        "position": "rime-start-double"
      }
    }
  ]
}
```

**Wichtige Felder zur konsistenten Sternchen-Logik:**
- `starMarker.type` steuert, welches Zeichen im Schriftbild visuell markiert wird (nicht hart pro Übung codieren — eine gemeinsame Komponente `<StarredSyllable>` o. ä. kann alle Fälle rendern).
- `category` treibt die Farbcodierung (rot/blau) und die Gruppierung in der Kapitel-Übersicht.

---

## 5. Visuelle Konventionen (durchgängig, aus bestehender App übernommen)

| Element | Farbe / Wert |
|---|---|
| CI-Farben | Teal `#6EBCAE`, Gold `#F5CD4A`, Coral `#E5915C`, Magenta `#BB3B85`, Dunkelgrün `#2F4B43` |
| Font | Lato |
| kurzer Vokal / kurzer Reim | Rot (`#A32D2D` als Textfarbe, hellrot als Hintergrund) |
| langer Vokal / langer Reim | Blau (`#185FA5` als Textfarbe, hellblau als Hintergrund) |
| verschiedene Mitlautkugeln (Sonderfall innerhalb „kurz") | bleibt rot (gehört zu „kurz", nicht eigene Farbe) |
| Sternkugeln | Coral, mit ★-Symbol über der Kugel |
| Dr. Zucchini | Meta-Signal-Figur, Sprechblase mit Coral-Akzent |
| Nepo | Haupt-Lernfigur, Teal-Akzent |

Terminologie (verbindlich, wird von Angelika geprüft): „Buchstabenkugeln", „Kerni" (Vokalkern), „Mitlautkugeln", „Sternkugel", „Verwandten-Brücke", „Zwielaute" (nicht „Doppellaute"), „echte Wörter" / „Fantasiewörter" (nicht „Pseudowörter").

---

## 6. Nicht Teil dieses Scopes

- Endung **-en** (blasse Kugel) — separates Modul, bereits bewusst ausgeklammert.
- **-lk-Reimgruppe** (Volk/Molk) — geprüft und verworfen, zu seltene Wörter.
- Lernwörter ohne Brücke (Bär, Käse, Käfer, Märchen) — als zukünftiges Merkwort-Modul vorgemerkt, nicht Teil der Verwandten-Brücke-Übung.
- Teacher-Portal, Zahlungsintegration, Mehrsprachigkeit — außerhalb dieses Feature-Scopes.

---

## 7. Offene Punkte für Angelika (fachliche Freigabe ausstehend)

- Wortauswahl „Terz/Sterz" (Herz-Reimgruppe) — Alternativvorschlag prüfen, falls zu selten für Zielgruppe.
- Vier Quellen noch einzuarbeiten: Grolimund, Auer Verlag, Mildenberger Wortbox, Gero Tacke (Content-Abgleich, kein Blocker für Entwicklung).
- Visuelles System (Apfel-Symbol, zwei Alters-Modi 8–10 / 11–14) ist separat in Überarbeitung — betrifft ggf. spätere Illustrationen dieser Übungen, nicht deren Datenmodell.
