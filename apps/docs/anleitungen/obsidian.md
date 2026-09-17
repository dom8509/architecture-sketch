# Obsidian

Das Plugin rendert sysarch in Notizen, öffnet `.arch`-Dateien im Editor der Web-App und zeigt
die Bibliothek in der Seitenleiste. Zur Installation siehe [Installation](/einstieg/installation#obsidian-plugin).

## Diagramme in Notizen

Schreibe einen Codeblock mit der Sprache `sysarch`:

````md
```sysarch
architecture "Door ECU" {
    component mcu: microcontroller { label "S32K3" }
    component driver: half_bridge
    mcu -> driver.IN
}
```
````

Im Lesemodus und in der Live-Vorschau erscheint das Diagramm, passend zur Breite der Notiz.
Fehler und Warnungen stehen darunter; ein Klick springt an die Stelle im Codeblock.

Den Rahmen fügt der Befehl **sysarch: Codeblock einfügen** mit einer kleinen Vorlage ein.

### Hell und dunkel

Setzt der Codeblock kein `theme`, folgt das Diagramm dem Obsidian-Modus
(`automotive-light` bzw. `automotive-dark`) und wechselt beim Umschalten mit. Ein `theme` im
Codeblock hat Vorrang. Das Verhalten ändert die Einstellung **Standard-Theme**.

### Kontextmenü am Diagramm

| Eintrag | Wirkung |
|---------|---------|
| **Quelle bearbeiten** | wechselt in den Bearbeitungsmodus, Cursor in den Codeblock |
| **Im Editor öffnen** | Fenster mit Editor, Vorschau und Diagnosen; **Übernehmen** schreibt in genau diesen Codeblock zurück, **Verwerfen** nicht |
| **SVG exportieren** | SVG-Datei im Exportordner |
| **PNG exportieren** | PNG in der eingestellten Skalierung |
| **SVG kopieren** | SVG-Quelltext in die Zwischenablage |
| **React Flow JSON exportieren** | `.reactflow.json` im Exportordner |

Der Dateiname kommt aus dem Titel (`"Door ECU"` → `door-ecu.svg`). Ein erneuter Export
überschreibt die Datei, damit eingebettete Bilder (`![[door-ecu.svg]]`) aktuell bleiben.

::: tip Codeblock inzwischen geändert?
Hat sich der Codeblock geändert, während das Editor-Fenster offen war, überschreibt das Plugin
nichts. Die neue Quelle liegt dann in der Zwischenablage.
:::

## `.arch`-Dateien

Dateien mit der Endung `.arch` öffnet Obsidian im selben Editor wie die Web-App: Quelltext,
Live-Vorschau und Diagnosen nebeneinander. Die Exporte stehen im Menü **Weitere Optionen** (⋯)
der Ansicht.

Eine neue Datei legt **sysarch: Neue .arch-Datei** an.

## Bibliothek in der Seitenleiste

**sysarch: Bibliothek anzeigen** — oder das Bibliotheks-Symbol in der linken Leiste — öffnet
alle Templates der Standardbibliothek in der rechten Seitenleiste:

- nach Kategorie gruppiert, mit Vorschau im aktuellen Theme, Label, Basis-Template und Pins
- das Suchfeld filtert nach Name, Label, Icon und Pin-Namen (`CANH` findet `can_transceiver`)
- ein **Klick** fügt `component <name>: <template>` an der Cursorposition der zuletzt aktiven
  Notiz oder `.arch`-Datei ein; ohne offenen Editor landet die Zeile in der Zwischenablage
- das Kontextmenü bietet **Einfügen** und **Kopieren**

Dieselben Templates mit Definition beschreibt die [Bibliotheks-Referenz](/referenz/bibliothek).

## Befehle

| Befehl | Wirkung |
|--------|---------|
| **Codeblock einfügen** | ` ```sysarch `-Block mit Vorlage an der Cursorposition |
| **Neue .arch-Datei** | legt `Architektur.arch` im Ordner für neue Dateien an und öffnet sie |
| **Bibliothek anzeigen** | öffnet die Bibliothek in der Seitenleiste |

## Einstellungen

| Einstellung | Bedeutung |
|-------------|-----------|
| **Standard-Theme** | Theme für Diagramme ohne `theme`; **Obsidian folgen** wählt hell oder dunkel passend zum Modus |
| **PNG-Skalierung** | Auflösung beim PNG-Export: 1×, 2× oder 3× |
| **Exportordner** | Ordner im Vault für SVG, PNG und React Flow JSON; leer = Anhangsordner laut Obsidian-Einstellungen |
