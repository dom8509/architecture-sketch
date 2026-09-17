# Entscheidungen

Festgelegte Designentscheidungen. Eine Änderung erfordert einen neuen Eintrag, der den
alten ausdrücklich ersetzt.

| # | Entscheidung | Begründung | Verworfen |
|---|--------------|------------|-----------|
| D1 | **Text ist führendes Modell**; alle anderen Darstellungen sind abgeleitet | diffbar, reviewbar, CI-fähig; keine zwei Datenmodelle | Canvas-State als Quelle, JSON als Quelle |
| D2 | **Eigene DSL** statt Mermaid-Erweiterung | Pins, Zonen, Systeme, Templates passen nicht in Mermaids Modell | Mermaid-Plugin, YAML/JSON-Format |
| D3 | **Kein Pixel, keine Farbe, keine Schriftgröße in der DSL** — nur `size`, `importance`, `category` | einheitliches Erscheinungsbild über alle Autor:innen | freie Styling-Attribute |
| D4 | **Ein Scene Graph, SVG als einzige Darstellung**; Vorschau = Export-SVG | WYSIWYG ohne zweiten Renderer | separater Canvas-Renderer für die Vorschau |
| D5 | **Core ohne Laufzeitabhängigkeiten**, eigener Layouter und Router | Determinismus, volle Kontrolle über Regeln, kleine Bundles | Dagre, ELK.js, Graphviz |
| D6 | **Eingebettete Font-Metriken** statt `measureText` | identische Geometrie in Browser, Obsidian, Node | DOM-Messung, Headless-Browser in der CLI |
| D7 | **Orthogonales Routing** ausschließlich | technische Lesbarkeit | Bézier, freie Polylinien |
| D8 | **`zone` = Layout-Band, `system` = semantische Grenze**, strikter Baum | Layout bleibt lösbar; Semantik bleibt ausdrückbar | ein generisches `group` für beides; überlappende Gruppen |
| D9 | **`theme` auf Dokumentebene, `category` auf Komponentenebene** | im Brainstorming hieß beides `style` — mehrdeutig | `style` für beides |
| D10 | **Overrides nur deklarativ** (`grid`, `hint row/column`) | robust gegen Änderungen, kein Pixel-Drift | gespeicherte x/y-Koordinaten |
| D11 | **Verlustfreier AST + TextEdits** für visuelles Editieren | Kommentare/Formatierung bleiben, minimale Diffs | AST → komplette Datei neu drucken |
| D12 | **Templates in der DSL selbst** (`define`), Bibliothek als `.archlib` | Teams erweitern ohne TypeScript | hartcodierte Komponenten im Renderer |
| D13 | **Signalarten als feste Menge** mit Gruppen, gemeinsam für Pins und Verbindungen | Linienform und spätere Regeln brauchen feste Semantik | freie Strings |
| D14 | **Metadaten nur im `meta { }`-Block** | Tippfehler bei Schlüsselwörtern bleiben Fehler | beliebige Schlüssel direkt in der Komponente |
| D15 | **Editor framework-frei** (DOM + CodeMirror 6) | derselbe Editor in Web-App und Obsidian | React-basierter Editor |
| D16 | **React-Flow-Export ohne React-Flow-Abhängigkeit**, inkl. gerouteter Punkte | Core bleibt frei; Zielanwendung übernimmt exakte Geometrie | Export via React-Flow-Instanz |
| D17 | **Formen aus fester Liste, Icons nur aus der Bibliothek** — beides nur im Template, nie pro Instanz; keine Raster-Bilder | Wiedererkennbarkeit ohne Stilbruch; Layout kennt jede Kontur; Export bleibt eigenständig und deterministisch | frei definierbare SVG-Formen, Bild-URLs, Icon pro Instanz |
| D18 | **Unbekannte Pins sind ein Fehler** (`E103` mit Vorschlag); der Editor bietet den Quick-Fix „Pin anlegen“ als TextEdit | Tippfehler erzeugen keine stillen neuen Pins; der Text bleibt vollständig (D1, D11) | implizites Anlegen im Skizzen-Modus |
| D19 | **Inter als einzige Schrift in v0.1**; der Font-Metriken-Generator ist schriftunabhängig gebaut | Determinismus mit einem Metriksatz (D6); weitere Schriften pro Theme bleiben ohne Umbau möglich | Corporate-Schrift pro Theme ab v0.1 |
| D20 | **Themes in v0.1 als TypeScript-Design-Tokens**; eine Theme-DSL folgt erst, wenn Teams eigene Corporate Styles brauchen | hält Sprache und M1/M2 klein | `theme … { }` in `.archlib` ab v0.1 |
| D21 | **Produkt und Repository heißen `sysarch`** | ein Name überall, umbenannt solange noch nichts auf das alte Repo verweist | Repository-Name `architecture-sketch` bis zum Release |
| D22 | **Lizenz MIT** | kurz, permissiv, üblich im TypeScript-/Obsidian-Ökosystem | Apache-2.0, MPL-2.0 |
| D23 | **Inline-SVG im DOM mit Präfix je Diagramm** (Schriftfamilie, `id`s); Exporte bleiben unverändert | `@font-face` und `id`s sind dokumentweit — mehrere Diagramme in einer Notiz und die Oberflächenschrift von Obsidian bzw. der Web-App dürfen sich nicht gegenseitig überschreiben | `<img>` mit Data-URL (verliert DOM-Zugriff für Auswahl in M7), eindeutige IDs schon im Renderer (bräche Byte-Gleichheit und Golden Files) |
