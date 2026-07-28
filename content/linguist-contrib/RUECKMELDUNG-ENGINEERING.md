# Rückmeldung Engineering — BLS-Lernapp Developer Handoff

**Bezieht sich auf:** eure erste Lieferung in iteration-1/ — lernapp3-opus.md (= BLS_Developer_Handoff.md, Stand Juli 2026) + die neun BLS_*.html-Kapitelpläne
**Von:** Engineering (Flo) · **An:** das Linguistik-Team · **Datum:** 2026-07-27

Maßgeblich ist die Version **lernapp3-opus.md**; lernapp2-sonnet.md ist damit überholt.

## Zusammenfassung

Das Material ist eine sehr gute Grundlage — es reicht aus, um das neue Übungstyp-System zu entwerfen und eine erste Welle an Lektionen zu bauen. Der wertvollste Teil sind dabei die **HTML-Kapitelpläne selbst**: Sie enthalten nicht nur Beschreibungen, sondern **fertige, spielbare Übungen mit echtem Wortmaterial, Lösungen und Feedback-Texten** (Kapitel 8: ca. 15 gebaute Übungen, Kapitel 9: ca. 25). Dieses Material können wir direkt in die App übernehmen, ohne selbst Pädagogik erfinden zu müssen — genau so soll es sein.

Eine Sache fehlt allerdings, und sie ist die wichtigste offene Frage (siehe unten): eine benannte **Fertigkeiten-Liste**. Ohne sie kann die App nicht entscheiden, *was* ein Kind als Nächstes üben soll — und auch keine zusätzlichen Lektionen automatisch erzeugen.

## Was gut funktioniert

- **Die 10 Übungstypen sind direkt baubar.** Die Beschreibungen in Abschnitt 4 des Handoffs passen fast eins zu eins auf die Architektur der App. Engineering baut alle zehn als wiederverwendbare Bausteine (siehe Entscheidungen).
- **Eure Stufen passen auf ein vorhandenes Feld.** Rezeptiv / analytisch / produktiv entspricht dem bestehenden Schwierigkeitsgrad 1–3 im Lektionsformat — keine Umbauten nötig.
- **5–8 Aufgaben pro Lektion** passt in das bestehende Lektionsformat (erlaubt sind 1–12).
- **Die Regeln sind präzise genug für spätere automatische Generierung.** Der Dehnungs-h-Entscheidungsbaum und die s/ss/ß-Regeln sind so klar formuliert, dass sie später als Leitplanken für KI-generierte Zusatzlektionen dienen können.
- **Das MORPHEUS-Wortmaterial ist vollständig.** Die ~120 Wortstämme samt Vor- und Nachsilben sind komplett aufgelistet und nach ☆-Kategorie geordnet — eine solide Basis für die Kapitel-10-Inhalte.
- **Nepomuk gibt es schon.** Der Begleiter existiert in der App als „Nepo" (Grafiken in allen Stimmungen vorhanden). Und „Dr. Zucchini nur im Trainerinnen-Handbuch" passt exakt zur bestehenden Trennung zwischen Familien-App und internem Trainer-Portal.
- **Audio-Konzept deckt sich.** Die App spricht heute schon per Sprachsynthese (Platzhalter) und hat pro Aufgabe bereits einen Platz für echte Aufnahmen — eure Anforderung aus Abschnitt 8 ist damit vorbereitet.

## Entscheidungen (zur Kenntnis, kein Handlungsbedarf)

1. **Alle 10 Übungstypen kommen in einer Welle.** Engineering baut die zehn wiederverwendbaren Typen gemeinsam, inklusive der technisch aufwendigeren (Sortieren, Ordnen, Paare verbinden, Fang-Spiel) — kein Etappen-Zuschnitt eurerseits nötig.
2. **App-Design bleibt, Nepomuk = Nepo.** Die App behält ihr bestehendes Erscheinungsbild und die Buddy-Wahl (Nepo oder Stella); der gewählte Buddy übernimmt die Coach-Rolle aus euren Prinzipien (kurzer Tipp bei Fehlern). Die CI-Farben und die Nur-Nepomuk-Regel aus dem Handoff verstehen wir als Vorgaben für das **Trainerinnen-Handbuch**, nicht für die App. Falls das anders gemeint war, bitte melden.
3. **Das Datenmodell aus Abschnitt 7 wird nicht übernommen.** Die App hat bereits ein Datenmodell, das dieselben Dinge abdeckt (Lektionen, Aufgaben, Fortschritt, Feedback). Für euch ändert das nichts — es war ein Vorschlag für ein System, das es schon gibt.
4. **Ihr schreibt weiterhin Markdown, niemals HTML oder Code.** Lektionen entstehen wie besprochen als Textdateien im content/-Ordner (siehe content/README.md). Engineering erweitert dieses Format um die neuen Übungstypen und aktualisiert die deutsche Anleitung, bevor ihr neue Inhalte anlegt. Die Übernahme der bereits gebauten HTML-Übungen in dieses Format macht Engineering.
5. **Audio bleibt vorerst Sprachsynthese.** Echte Aufnahmen (österreichisches Hochdeutsch) kommen später; der technische Platz dafür ist vorhanden.

## Reicht das Material? Eine Hochrechnung

Erfolgskriterium: Ein Kind trainiert **5-mal pro Woche, 5–10 Minuten, über 6–9 Monate**. Das ergibt 130–195 Trainingseinheiten; bei eurem Format (2–3 Minuten, 5–8 Aufgaben pro Lektion) sind das 2–3 Lektionen pro Einheit — insgesamt also **rund 300–500 gespielte Lektionen bzw. ca. 2.600–4.500 beantwortete Aufgaben**.

Dem steht gegenüber:

- Die Kapitelpläne definieren **rund 105 Übungen** (Kap 1: 9, Kap 7: 5, Kap 8: 15, Kap 9: ca. 27, Kap 10: ca. 49). Voll ausgearbeitet wären das ca. 680 einzelne Aufgaben.
- **Fertiges Aufgabenmaterial existiert aber nur für die ca. 45–48 gebauten Prototyp-Übungen** — also ca. 350–400 Aufgaben. Die „zu bauen"-Zeilen sind Struktur ohne Inhalt.
- Annahme dabei: Durch verteilte Wiederholung und eure Formatwechsel (hören → tippen → zuordnen → im Satz) bleibt jede Aufgabe etwa **3 Durchgänge** lang sinnvoll.

Ergebnis gegenüber dem 100-%-Ziel:

- **Heute vorhandenes Material: ca. 30–35 %** des Bedarfs (6 Monate: ca. 40 %, 9 Monate: ca. 25 %). Anders gesagt: Die gebauten Prototypen tragen ein Kind etwa **2 der 6–9 Monate**.
- **Export voll ausgearbeitet: ca. 65–70 %** (6 Monate: ca. 85 %, 9 Monate: ca. 55 %).

Drei Einordnungen dazu:

1. **Das fehlende Drittel ist kein Versäumnis, sondern euer Plan:** Die 120 Wortstämme plus die präzisen Regeln (Dehnungs-h-Baum, s/ss/ß) sind das Rohmaterial, aus dem die App später automatisch Zusatzlektionen erzeugen kann. Diese Maschinerie startet aber erst mit der Fertigkeiten-Liste (Frage 1) — die Lücke zwischen 65 % und 100 % hängt also an derselben Antwort wie alles andere.
2. **Der Bedarf könnte größer sein:** Falls Kapitel 2–6 (Frage 2) auch App-Inhalt werden sollen, wächst das Ziel und die Prozentwerte sinken entsprechend.
3. **In der Praxis reicht es etwas weiter, als die Zahlen wirken:** Die App wiederholt schwache und fällige Aufgaben automatisch aus dem Bestand — und gerade Kinder, die Unterstützung brauchen, wiederholen mehr. Voll ausgearbeitet dürfte das Material für die meisten 6-Monats-Verläufe genügen und erst bei starken Kindern über 9 Monate knapp werden.

## Vorschlag Engineering: Wie aus dem Material ein endloser Vorrat wird

Die Lücke zwischen zwei Dritteln und 100 % muss niemand von Hand schreiben. Der Schlüssel liegt in einer Beobachtung über euer eigenes Material: Eure Übungstypen sind in Wahrheit **Schablonen**. „Kurz oder lang?", „Wortstamm finden", „ss oder ß?" funktionieren mit jedem Wort, das die passenden Merkmale hat. Engineering schlägt deshalb folgenden Aufbau vor — zur Diskussion, nicht beschlossen:

**1. Ein annotierter Wortschatz statt einzelner Aufgaben.** Wir bauen eine Wortliste (Ziel: ca. 1.000 kindgerechte Wörter, z. B. aus dem österreichischen Grundwortschatz), bei der jedes Wort seine Merkmale trägt: Selbstlaut kurz/lang, Silben, Wortstamm, ☆-Kategorie. Aus 1.000 Wörtern × 10 Übungstypen × wechselnden Antwortmöglichkeiten entstehen rechnerisch Millionen verschiedener Aufgaben — und jede Lösung ist **beweisbar richtig**, weil sie aus den Merkmalen folgt statt jedes Mal neu erfunden zu werden. (Ein falscher Lösungsschlüssel wäre das Schlimmste, was die App einem Kind antun kann — dieser Weg schließt das konstruktionsbedingt aus.)

**2. Die Annotation machen nicht ihr von Hand.** Eure Regeln sind zum Teil schon Algorithmen (der Dehnungs-h-Entscheidungsbaum!), Silbentrennung gibt es maschinell, den Rest übernimmt KI — und wo Regel und KI sich widersprechen, landet das Wort zur Klärung bei euch. **Eure Rolle verschiebt sich damit vom Schreiben hunderter Aufgaben zum Prüfen des Merkmal-Schemas und von Stichproben** — der wertvollste Einsatz eurer knappen Fachzeit. Die Pädagogik (Typen, Regeln, Progression) bleibt vollständig eure; die Vervielfältigung ist Handwerk.

**3. Abwechslung ist auch eine Darstellungsfrage.** Euer eigenes Prinzip Nr. 4 sagt: Dasselbe Wort soll in verschiedenen Formaten wiederkommen. Ein annotiertes Wort ergibt also legitim 5–8 verschieden wirkende Aufgaben (hören → wählen, sehen → tippen, sortieren, markieren, ordnen). Dazu: wechselnde Antwortmöglichkeiten, pro Kind Buch führen, was es schon gesehen hat, und günstige Themen-Rahmen (Nepo im Weltraum, Piratenwoche) um dieselben regelfesten Aufgaben.

**4. Die Fehler des Kindes sind die beste unerschöpfliche Quelle.** Die Hausübungs-Prüfung durch die Trainerinnen liefert schon heute verifizierte Fehlerwörter pro Kind. Lektionen aus den **eigenen** Fehlerwörtern sind per Definition einzigartig, nie repetitiv und pädagogisch das wertvollste Material der App. Diesen Kreislauf wollen wir ausbauen.

**5. Fantasiewörter sind grenzenlos.** Ihr habt sie selbst schon im Programm (Kap 8 F10): regelkonforme Kunstwörter lassen sich algorithmisch unbegrenzt erzeugen — gut fürs Lesen/Erlesen, zurückhaltend beim Schreiben eingesetzt.

Zusammengenommen: Schablonen über einem geprüften Wortschatz als Rückgrat, Formatwechsel als Abwechslungsschicht, Fehlerwörter als persönliche Krönung. Damit ist die 100-%-Marke keine Fleißfrage mehr. Aber auch hier gilt: **Nichts davon startet ohne die Fertigkeiten-Liste (Frage 1)** — der Generator muss jede erzeugte Aufgabe mit euren Fertigkeiten etikettieren können.

## Offene Fragen und Bitten an euch

**1. Fertigkeiten-Liste (wichtigste Frage — blockiert den Rest).**
Die App plant Wiederholungen pro *Fertigkeit*: Jede Aufgabe trägt ein oder mehrere Fertigkeits-Etiketten, und aus den Ergebnissen entscheidet die App, was ein Kind wann wieder üben soll. Auch die automatische Erzeugung zusätzlicher Lektionen zielt auf diese Etiketten. Der Handoff legt eine Einteilung nahe (Kapitel, ☆-Kategorien), benennt sie aber nicht ausdrücklich.

Was wir von euch brauchen: **eine feste Liste von Fertigkeiten** — sinnvoll gegliedert, in eurer Fachlogik. Zum Beispiel (nur zur Illustration, bitte nicht als Vorschlag lesen): selbstlaute, reime, kurz-lang, schreibsilben, vorsilben, wortstamm-doppelung, dehnungs-h, s-schreibung, … Dazu pro Übung (E1, F5, A3, …) die Angabe, welche Fertigkeit(en) sie trainiert. Die Granularität bestimmt ihr: grob = ruhigere Steuerung, fein = gezieltere Wiederholung.

Ob ihr die Liste selbst schreibt oder mit Claude entwerfen lasst, ist eure Sache — wichtig ist allein, dass **Angelika sie fachlich prüft und verabschiedet**, denn die App steuert danach dauerhaft die Wiederholungen jedes Kindes. Ein Claude-Entwurf ohne diese Prüfung genügt nicht.

*Antwortformat* (so können wir es direkt übernehmen): eine neue Datei content/linguist-contrib/fertigkeiten.md mit zwei Tabellen —
1. Fertigkeiten: Kennung (Kleinbuchstaben, Bindestriche, z. B. dehnungs-h) · deutsche Beschreibung (1 Satz) · zugehöriges Kapitel.
2. Zuordnung: Übungs-Code (E1, F5, A3, …) · Fertigkeits-Kennung(en).

Jede Übung braucht mindestens eine Kennung; die Kennungen sind dauerhaft (späteres Umbenennen ist teuer, Ergänzen ist billig).

**2. Kapitel 2–6.** Der Handoff umfasst Kapitel 1, 7, 8, 9 und 10. Sind 2–6 reine Trainerinnen-Kapitel (Präsenzarbeit), oder kommen sie später als App-Inhalt?

**3. Kugel-Grafiken.** Das Kugel-System (Buchstabenkugel, gelber Kerni, ☆, kleine Kerni-Kugel) existiert bisher nur als Darstellung in euren HTML-Prototypen — es gibt noch keine Grafik-Dateien dafür. Sollen wir die Kugeln nach dem Vorbild der Prototypen gestalten und euch zur Freigabe vorlegen, oder liefert ihr Entwürfe?

**4. Wortmaterial für die „zu bauen"-Übungen.** Konkrete Aufgaben (Wörter, Lösungen, Feedback) existieren nur für die bereits gebauten Prototyp-Übungen. Für alle als „zu bauen" markierten Übungen fehlt das Material — die Hochrechnung oben zeigt, dass genau hier der Sprung von ca. einem Drittel auf ca. zwei Drittel des Bedarfs liegt. Passt es für euch, dass ihr diese Aufgaben nach und nach als content/-Dateien anlegt, sobald das erweiterte Format bereitsteht? Auch hier gilt: Entwerfen mit Claude ist ausdrücklich vorgesehen — die automatische Prüfung (content:validate, Fehlermeldungen auf Deutsch) ist euer erster Korrekturleser und meldet Formfehler sofort; ihr könnt mit Claude so lange nachbessern, bis die Prüfung grün ist. Die fachliche Prüfung der Wörter und Erklärungen bleibt bei euch.

**5. Feedback-Texte als Pflichtfelder.** Nach euren Duolingo-Prinzipien braucht jede Aufgabe künftig drei Angaben, die es heute noch nicht gibt (aktuell: nur ein Lob-Satz bei „richtig"). Bestätigt ihr, dass sie für **jede** neue Aufgabe verbindlich sind? Konkret werden das diese Felder im Lektionsformat:
- feedbackRichtig — ein Satz, höchstens 200 Zeichen.
- feedbackFalsch — ein Satz **mit der Erklärung**, höchstens 200 Zeichen.
- vorgeloest — ja/nein: wird das erste Item der Übung vorgelöst gezeigt?

**6. Einzel-Übungen außerhalb der 10 Typen.** Labyrinth (Kap 1 F1), Silben-Tabelle (Kap 9 E8), Wortrallye (Kap 10 A8) und einige Kapitel-8-Übungen sind Sonderbauten. Wie wichtig sind sie euch im Vergleich zu den 10 Standard-Typen — dürfen sie zeitlich nach hinten?

**7. Einstufungstest und Diagnostik.** BLS_Einstufungstest.html und BLS_Diagnostikdiktate.html — bleiben die auf der Trainerinnen-Seite (Präsenz), oder soll die Eingangsdiagnostik irgendwann in die App?

**8. Bitte: eine kanonische Datei pro Lieferung.** Bei diesem Export lagen zwei Fassungen nebeneinander (lernapp2-sonnet.md und lernapp3-opus.md), und wir mussten nachfragen, welche gilt. Wenn ihr mit Claude mehrere Entwürfe erzeugt: bitte künftig pro Lieferung genau **eine** gültige Datei behalten (überholte Entwürfe löschen oder klar als überholt markieren) — dann bauen wir nie auf der falschen Fassung auf.

## Wie es weitergeht

Sobald die Fertigkeiten-Liste (Frage 1) und die Materialfragen (4, 5) beantwortet sind:

1. Engineering erweitert das Lektionsformat um die 10 Übungstypen und aktualisiert content/README.md (eure Anleitung).
2. Engineering überträgt die **bereits gebauten** Prototyp-Übungen aus den HTML-Dateien in content/-Lektionen — ihr prüft das Ergebnis per Pull Request, wie gewohnt.
3. Die App-Umsetzung folgt der Priorisierung aus eurem Abschnitt 11: erst die Bausteine, dann Kapitel 1 komplett, dann Kapitel 8.

Und unabhängig davon: Sagt uns, was ihr vom Generator-Vorschlag oben haltet — er entscheidet, ob die fehlenden Aufgaben (Frage 4) von euch geschrieben oder nur von euch geprüft werden müssen.

Fragen gern direkt an Flo.
