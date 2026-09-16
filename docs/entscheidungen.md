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
