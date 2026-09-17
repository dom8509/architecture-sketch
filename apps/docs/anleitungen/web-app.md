# Web-App

Die <a href="/sysarch/app/" target="_blank">Web-App ↗</a> ist Editor, Vorschau und Exportwerkzeug in
einem. Sie läuft vollständig im Browser, ohne Konto und ohne Server.

## Aufbau

| Bereich | Inhalt |
|---------|--------|
| Werkzeugleiste | Datei, Beispiele, Theme, Exporte, Teilen, Präsentation |
| Editor (links) | Quelltext mit Highlighting, Autovervollständigung und Diagnosen am Rand |
| Vorschau (rechts) | Live-Diagramm; Zoom per Mausrad, Verschieben per Ziehen, Doppelklick oder **Einpassen** passt ein |
| Diagnosenleiste (unten) | Fehler, Warnungen und Hinweise; ein Klick springt an die Stelle |

Die Trennlinie zwischen Editor und Vorschau lässt sich verschieben.

## Schreiben

- **Autovervollständigung** schlägt Template-Namen nach `:`, Pin-Namen nach `komponente.`,
  Signalarten nach `pin` und `type` sowie feste Werte nach `theme`, `size`, `shape` usw. vor.
- **Diagnosen** erscheinen während des Tippens. Bei Fehlern bleibt der letzte gültige Stand in
  der Vorschau stehen und wird ausgegraut.
- **Quick-Fixes**: Hat eine Diagnose einen Vorschlag („meintest du `CAN_TX`?“), übernimmst du
  ihn im Editor per Klick. Bei einem unbekannten Pin ([E103](/referenz/diagnosen#e103)) legt
  die Aktion **Pin `…` anlegen** ihn an der Komponente an; die Art leitet sie aus der Verbindung ab.

## Dateien

| Aktion | Wirkung |
|--------|---------|
| **Neu** | leere Architektur als Vorlage |
| **Öffnen** (⌘O / Strg+O) | `.arch`-Datei laden |
| **Speichern** (⌘S / Strg+S) | als `.arch` speichern; in Chromium-Browsern direkt in die geöffnete Datei |
| **Beispiele…** | eines der [Beispiele](/referenz/beispiele) laden |

Der aktuelle Stand wird zusätzlich als **Entwurf** im Browser gesichert und beim nächsten
Öffnen wiederhergestellt.

## Theme wählen

Das Auswahlfeld **Theme** überschreibt das Theme für Vorschau und Export, ohne den Quelltext zu
ändern. **aus der Quelle** nimmt das `theme` des Dokuments. Alle Themes zeigt die
[Theme-Referenz](/referenz/themes).

## Exportieren

| Schaltfläche | Ergebnis |
|--------------|----------|
| **SVG** | eigenständige SVG-Datei mit eingebetteter Schrift |
| **SVG kopieren** | SVG-Quelltext in die Zwischenablage |
| **PNG** | Rastergrafik in 1×, 2× oder 3× |
| **React Flow** | `.reactflow.json` mit Knoten, Pins und gerouteten Kanten — siehe [React Flow](./react-flow) |

Exporte sind nur bei fehlerfreiem Quelltext möglich und byte-gleich mit der CLI.

## Teilen

**Link teilen** kopiert eine Adresse, deren Fragment (`#src=…`) den komprimierten Quelltext
enthält. Wer den Link öffnet, sieht genau dein Diagramm — gespeichert wird dabei nichts auf
einem Server. Sehr große Diagramme ergeben lange Links; dafür warnt die Web-App.

Jedes Diagramm in dieser Dokumentation hat einen solchen Link: **In der Web-App öffnen**.

## Präsentieren

**Präsentation** schaltet in den Vollbildmodus und zeigt nur das Diagramm, eingepasst auf den
Bildschirm. `Esc` beendet den Modus. Für Beamer eignet sich das Theme `presentation`.
