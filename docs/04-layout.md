# 04 — Layout & Routing

Das Layout ist der schwierigste Teil. Deshalb löst sysarch **kein allgemeines
Graph-Layout**, sondern ein eng umrissenes Problem: technische Architekturdiagramme mit
Hauptflussrichtung, Zonen, Systemgrenzen, Pins und orthogonalen Verbindungen.

Leitlinie: Lieber 80 % durch klare Regeln plus deklarative Overrides (`grid`, `hint`)
als ein Forschungsprojekt.

Alle Algorithmen sind eigener Code ohne Dagre, ELK oder Graphviz. Alle Iterationen haben
eine feste Reihenfolge (Deklarationsreihenfolge als Tie-Breaker) — **keine Zufallszahlen,
keine Hash-Map-Iteration über unsortierte Schlüssel**.

---

## Phasen

```
ArchitectureModel
   │ 1. Ränge          Komponente → Spalte entlang der Flussrichtung
   │ 2. Zonen          Ränge je Zone zusammenhängend machen
   │ 3. Reihenfolge    Position quer zur Flussrichtung, Kreuzungen reduzieren
   │ 4. Overrides      grid / hint anwenden
   │ 5. Größen         Text messen, Pins zählen, Box-Größe auf Grid runden
   │ 6. Koordinaten    Ränge und Reihen in Pixel, Gruppenrahmen berechnen
   │ 7. Routing        orthogonale Pfade von Pin zu Pin
   │ 8. Labels         Verbindungslabels platzieren
   ▼
SceneGraph
```

Im Folgenden gilt `direction LR`. Für `TB` werden x und y am Ende vertauscht; alle
Phasen rechnen in abstrakten Achsen *main* (Fluss) und *cross* (quer).

---

## 1. Ränge

- Graph: Komponenten als Knoten, Verbindungen als Kanten.
  `forward` zeigt von Quelle nach Ziel. `bidirectional` und `none` zählen als Kante in
  Deklarationsrichtung, aber mit halbem Gewicht.
- **Zyklen brechen** (z. B. Rückmeldung `hb1.IS -> mcu`): Tiefensuche in
  Deklarationsreihenfolge; Rückwärtskanten werden für die Rangberechnung umgedreht und
  später als Rückführung geroutet.
- **Rang** = längster Pfad von einer Quelle. Danach Kompaktierung: Knoten ohne
  Vorgänger rücken so nah wie möglich an ihren ersten Nachfolger.
- Unverbundene Komponenten erhalten Rang 0 ihrer Zone.

## 2. Zonen

Zonen sind zusammenhängende Rangbereiche in Deklarationsreihenfolge:

```
Zone supply    │ Zone processing │ Zone actuation
Rang 0 … 1     │ Rang 2          │ Rang 3 … 4
```

- Ränge werden **pro Zone** berechnet (nur zoneninterne Kanten zählen) und dann
  hintereinander gereiht.
- Kanten zwischen Zonen gegen die Zonenreihenfolge sind zulässig und werden als
  Rückführung geroutet.

## 3. Reihenfolge innerhalb eines Rangs

- Startreihenfolge: Deklarationsreihenfolge.
- **Barycenter-Heuristik**, feste Anzahl Durchläufe (4× vorwärts/rückwärts). Position
  eines Knotens = Mittelwert der Positionen seiner Nachbarn im Nachbarrang — auf
  **Pin-Ebene**, nicht Knoten-Ebene: Ein Pin weiter unten an der MCU zieht den
  Nachbarn nach unten.
- **Systeme als Cluster:** Mitglieder eines Systems bleiben in jedem Rang
  zusammenhängend. Sortiert wird zuerst innerhalb der innersten Gruppe, dann die Gruppen
  als Blöcke nach ihrem mittleren Barycenter.
- Gleichstände → Deklarationsreihenfolge. Das Ergebnis ändert sich dadurch nicht, wenn
  jemand eine unverbundene Komponente am Dateiende hinzufügt.

## 4. Overrides

- `grid`: Zeile/Spalte im fertigen Bild. Spalten bestimmen den Rang (bei `LR`),
  Zeilen die Reihenfolge. Aufgeführte Komponenten sind fixiert, die übrigen werden in
  Phase 1–3 um sie herum eingefügt.
- `hint row|column`: wie ein Grid-Eintrag für eine einzelne Komponente.
- Konflikte (zwei Komponenten in derselben Zelle) → Fehler, Layout fällt für die
  betroffenen Komponenten auf automatisch zurück.

## 5. Größen

- Textbreiten kommen aus **eingebetteten Font-Metriken** (Advance-Widths + Kerning-Paare
  der Theme-Schrift als generierte Tabelle), nicht aus `canvas.measureText`. Nur so ist die
  Geometrie in Browser, Obsidian und Node identisch.
- Komponentenbreite = max(`minWidth[size]`, Icon + Abstand + Labelbreite + Padding,
  breiteste Pin-Label-Kombination links + rechts + Mindestabstand).
- Komponentenhöhe = max(`minHeight[size]`, Label + Padding, Pins pro Seite × `pinPitch`).
- Alle Größen werden **auf das Grid aufgerundet** (Standard 16 px).
- Pins sitzen auf Grid-Punkten, gleichmäßig um die Seitenmitte verteilt.
- Die Größenberechnung erfolgt für den **Innenbereich** der Form (siehe unten); die Hülle
  wird daraus zurückgerechnet.
- Labels, die breiter als die dreifache `minWidth` wären, werden an Wortgrenzen
  umbrochen; kein Abschneiden, keine Schriftverkleinerung.

### Formen und Pins

Jede Form liefert drei Funktionen, die Layout und Renderer gemeinsam nutzen:

```ts
interface ShapeGeometry {
  /** Innenbereich für Icon + Label, relativ zur Hülle. */
  inner(hull: Rect): Rect;
  /** Kleinste Hülle, deren Innenbereich `content` aufnimmt. */
  hullFor(content: Size, pinsPerSide: Record<Side, number>): Size;
  /** Punkt auf der Kontur für einen Pin an Seite `side` und Querkoordinate `t`. */
  contour(hull: Rect, side: Side, t: number): Point;
}
```

| Form | Innenbereich | Hülle | Pins |
|------|--------------|-------|------|
| `rounded`, `rect` | Hülle minus Padding | frei | auf dem Rand |
| `circle` | einbeschriebenes Quadrat (≈ 0,71 × Durchmesser) | quadratisch | Schnittpunkt der Pin-Geraden mit dem Kreis |
| `hexagon` | Mittelrechteck zwischen den Spitzen | frei, Spitzen = ¼ Höhe | links/rechts auf den Schrägen, oben/unten auf den Kanten |
| `cylinder` | Rumpf zwischen den Ellipsen | frei, Ellipsenhöhe = 1 Grid-Einheit | oben/unten auf der Ellipse, links/rechts auf dem Rand |

- **Pin-Positionen bleiben auf der Hülle.** Liegt die Kontur innerhalb der Hülle (Kreis,
  Sechseck), zeichnet der Renderer einen kurzen Anschlussstummel von der Kontur bis zur
  Hüllkante. Routing und Kanalzuteilung sehen dadurch für alle Formen gleich aus und
  müssen keine Sonderfälle kennen.
- Bei `circle` mit mehr als drei Pins pro Seite wird der Durchmesser vergrößert, bis die
  Stummel höchstens eine halbe Hüllbreite lang sind.
- Icon und Label werden im Innenbereich zentriert: Icon links vom Label, bei `size small`
  und `circle` Icon über dem Label.

## 6. Koordinaten

- Rangbreite = breiteste Komponente des Rangs; Komponenten innerhalb des Rangs zentriert.
- Abstände: `nodeGapMain` zwischen Rängen, `nodeGapCross` zwischen Komponenten,
  `zoneGap` zwischen Zonen. Der Abstand zwischen zwei Rängen wächst um eine
  Grid-Einheit je Verbindung, die dort vertikal geführt werden muss (Kanalbreite).
- **Pin-Ausrichtung:** Hat ein Knoten genau eine Verbindung zum Vorgängerrang, wird er
  quer so verschoben, dass die Verbindung gerade verläuft — sofern dadurch keine
  Überlappung entsteht.
- Gruppenrahmen = Hülle der Mitglieder + `groupPadding` + Platz für das Gruppenlabel.
  Verschachtelte Systeme addieren ihr Padding.

## 7. Orthogonales Routing

Keine Bézier-Kurven. Nur horizontale und vertikale Segmente:

```
mcu ●─────────┐
              │
              └───────▶● hb1
```

**Verfahren:**

1. Aus Komponenten- und Gruppenrechtecken wird ein **spärliches Routing-Gitter** gebaut
   (Knotenlinien an Hindernisrändern, Pin-Koordinaten und Kanalmitten).
2. Jede Verbindung startet mit einem Stummel senkrecht aus der Pin-Seite
   (mindestens eine Grid-Einheit).
3. **A\*** auf dem Gitter mit Kosten = Länge + Knickstrafe (hoch) + Kreuzungsstrafe
   (mittel) + Strafe für Segmente parallel und deckungsgleich zu bereits gerouteten
   Verbindungen (sehr hoch).
4. Reihenfolge der Verbindungen: Versorgung zuerst, dann Busse, Einzelsignale, Diagnose;
   innerhalb der Gruppe Deklarationsreihenfolge.
5. **Kanal-Zuteilung:** Parallele vertikale Segmente im selben Zwischenraum erhalten
   eigene Spuren im Grid-Abstand, sortiert nach Ziel-Position, damit sie sich nicht kreuzen.
6. **Rückführungen** (gebrochene Zyklen) laufen außen um die beteiligten Komponenten
   herum — unterhalb bei `LR`, rechts bei `TB`.
7. Körperanschlüsse (Verbindung ohne Pin) erhalten einen virtuellen Port auf der Seite
   zur Gegenstelle, mehrere Ports auf einer Seite werden verteilt.

## 8. Verbindungslabels

- Kandidaten: Mitte des längsten Segments, dann Segment am Quell-Pin, dann am Ziel-Pin.
- Gewählt wird der erste Kandidat ohne Überlappung mit Komponenten, Pins oder anderen Labels.
- Label bekommt einen Halo in Hintergrundfarbe.
- Findet sich kein freier Platz, wird der Kanal um eine Grid-Einheit verbreitert und
  Phase 6–8 wiederholt (höchstens zweimal).

---

## Grenzen v0.1 (bewusst)

- Keine Optimalität. Kreuzungen werden reduziert, nicht minimiert.
- Keine Verbindungen, die durch Systemrahmen „tunneln“; sie laufen über den Rahmenrand.
- Keine Bündelung von Busleitungen zu Sammelschienen (Kandidat für v0.2: Komponente
  `bus` als horizontale Schiene).
- Große Diagramme (> 100 Komponenten) sind nicht Zielgruppe; dafür gibt es später Views.

## Testbarkeit

- **Golden Files:** `examples/*.arch` → Scene-Graph-JSON und SVG werden eingecheckt;
  jede Layoutänderung ist im Review als Diff sichtbar.
- **Eigenschaftstests:** keine überlappenden Komponenten, alle Pfade orthogonal, alle
  Koordinaten auf dem Grid, Pfade schneiden keine fremden Komponenten, Label und Icon
  liegen vollständig im Innenbereich ihrer Form.
- **Stabilitätstest:** Unverbundene Komponente am Dateiende hinzufügen darf keine
  bestehende Position ändern.
