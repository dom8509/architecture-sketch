# 02 — DSL v0.1

Die DSL ist bewusst klein. v0.1 kennt genau diese Konstrukte:

`architecture` · `theme` · `direction` · `component` · `pin` · `zone` · `system` ·
Verbindungen · `layout` · `define` (inkl. `shape` und `icon`)

Alles andere (Views, `use`, Metadaten-Vererbung, Plausibilitätsregeln) ist für spätere
Versionen reserviert — siehe [Roadmap](08-roadmap.md).

Dateiendungen: `.arch` für Architekturen, `.archlib` für Bibliotheken.
Obsidian-Codeblock-Sprache: `sysarch`.

---

## 1. Überblick an einem Beispiel

```sysarch
architecture "Body Control Module" {
    theme automotive-light
    direction LR

    zone supply {
        label "Power"
        component battery: battery { label "KL30" }
        component regulator: power_supply { label "5 V Supply" }
    }

    zone processing {
        label "Processing"
        system ecu {
            label "BCM"
            component mcu: microcontroller {
                label "RH850"
                importance primary
                left {
                    pin power VDD
                    pin ground GND
                    pin analog CURRENT_SENSE
                }
                right {
                    pin pwm HB1_PWM
                    pin can CAN_TX
                    pin can CAN_RX
                }
            }
        }
    }

    zone actuation {
        label "Actuation"
        component hb1: half_bridge { label "Half Bridge 1" }
        component motor: motor { label "DC Motor" }
    }

    battery -> regulator.VIN      { label "KL30"  type power }
    regulator.VOUT -> mcu.VDD     { label "5 V"   type power }
    mcu.HB1_PWM -> hb1.IN         { label "PWM" }
    hb1.IS -> mcu.CURRENT_SENSE   { label "Current Sense" }
    hb1.OUT -> motor              { label "Motor Output" }
}
```

---

## 2. Lexikalik

| Element | Regel |
|---------|-------|
| Kommentare | `// bis Zeilenende` und `/* Block */` |
| Bezeichner | `[A-Za-z_][A-Za-z0-9_]*`, zusätzlich `-` wenn direkt ein Buchstabe folgt (`automotive-light`). Groß-/Kleinschreibung zählt. |
| Strings | `"…"` mit Escapes `\"`, `\\`, `\n` (Zeilenumbruch im Label) |
| Ganzzahlen | `[0-9]+` (nur für `hint`) |
| Operatoren | `->` `<-` `<->` `--` `.` `:` `\|` `{` `}` |
| Zeilenumbrüche | bedeutungslos — außer innerhalb von `grid { }`, dort trennen sie Zeilen |

Schlüsselwörter sind **kontextabhängig**: `power` ist Signalart nach `pin`, darf aber
trotzdem als Komponenten-ID verwendet werden. Der Parser entscheidet mit maximal zwei
Token Lookahead.

Die Regel für `-` in Bezeichnern macht `a--b` eindeutig (`a`, `--`, `b`), ebenso `a->b`.

---

## 3. Grammatik (EBNF)

```ebnf
document      = { define } architecture ;

architecture  = "architecture" STRING "{" { arch_stmt } "}" ;
arch_stmt     = theme | direction | layout | zone | system | component | connection ;

theme         = "theme" IDENT ;
direction     = "direction" ( "LR" | "TB" ) ;

zone          = "zone" IDENT "{" { label | system | component } "}" ;
system        = "system" IDENT "{" { label | system | component } "}" ;

component     = "component" IDENT [ ":" IDENT ] [ "{" { comp_stmt } "}" ] ;
comp_stmt     = label | size | importance | category | pin | side_block | hint | meta ;

pin           = "pin" IDENT IDENT [ STRING ] ;          (* Art, Name, optionales Label *)
side_block    = ( "left" | "right" | "top" | "bottom" ) "{" { pin } "}" ;

label         = "label" STRING ;
size          = "size" ( "small" | "medium" | "large" ) ;
importance    = "importance" ( "primary" | "secondary" ) ;
category      = "category" IDENT ;
hint          = "hint" ( "row" | "column" ) INT ;
meta          = "meta" "{" { IDENT STRING } "}" ;

connection    = endpoint arrow endpoint [ "{" { label | conn_type } "}" ] ;
endpoint      = IDENT [ "." IDENT ] ;
arrow         = "->" | "<-" | "<->" | "--" ;
conn_type     = "type" IDENT ;

layout        = "layout" "{" { mode | grid } "}" ;
mode          = "mode" ( "strict" | "assisted" ) ;
grid          = "grid" "{" grid_row { NEWLINE grid_row } "}" ;
grid_row      = cell { "|" cell } ;
cell          = IDENT | "." ;

define        = "define" IDENT [ "extends" IDENT ] "{" { def_stmt } "}" ;
def_stmt      = label | size | category | shape | icon | pin | side_block ;
shape         = "shape" ( "rect" | "rounded" | "circle" | "hexagon" | "cylinder" ) ;
icon          = "icon" IDENT ;                          (* "none" entfernt ein geerbtes Icon *)
```

---

## 4. Semantik

### 4.1 Komponenten

```sysarch
component <id>[: <template>] { … }
```

- `id` ist im gesamten Dokument eindeutig — auch über Zonen und Systeme hinweg.
- Ohne Template ist der Typ `block` (abgerundetes Rechteck, Kategorie `generic`, kein Icon).
- **Form und Icon** kommen ausschließlich aus dem Template (siehe 4.6). Eine Instanz kann
  sie nicht setzen; wer für eine Komponente eine andere Darstellung will, leitet ein
  lokales Template ab (`define window_motor extends motor { icon window }`).
- **Label-Vorrang:** Instanz-`label` › Template-`label` › `id`.
- `size` und `importance` sind die **einzigen** Größen-/Gewichtungsstellschrauben.
  Das Theme übersetzt sie in Mindestbreite, Rahmenstärke und Schriftschnitt.
- `category` wählt die Farbfamilie im Theme (`power`, `controller`, `communication`,
  `sensor`, `actuator`, `software`, `external`, `generic`). Templates setzen eine Vorgabe.
- `meta { voltage "12 V" }` speichert Freitext-Metadaten. Sie werden in v0.1 **nicht**
  gerendert, aber exportiert (React Flow `data.meta`). Metadaten stehen bewusst in einem
  eigenen Block, damit Tippfehler wie `lable "x"` ein Fehler bleiben und nicht still als
  Metadatum durchgehen.

### 4.2 Pins

```sysarch
pin <art> <NAME> ["Anzeigelabel"]
```

- Adresse eines Pins: `<komponente>.<NAME>` — z. B. `mcu.CAN_TX`.
- Pin-Namen sind pro Komponente eindeutig.
- **Seite:**
  1. Pin steht in einem `left`/`right`/`top`/`bottom`-Block → diese Seite.
  2. sonst: Seite aus dem Template.
  3. sonst: aus den Verbindungen abgeleitet. Bei `direction LR` wandern Pins mit
     überwiegend eingehenden Verbindungen nach links, mit ausgehenden nach rechts
     (bei `TB` entsprechend oben/unten). Gleichstand und unverbundene Pins → links bzw. oben.
- **Reihenfolge** auf einer Seite = Deklarationsreihenfolge (Template-Pins zuerst).
- Eine Instanz darf einen Template-Pin gleicher Art neu deklarieren, um ihn auf eine
  andere Seite zu legen. Neudeklaration mit anderer Art ist ein Fehler.

**Signalarten** (gemeinsamer Wertevorrat für Pins und Verbindungen, fest in v0.1):

| Gruppe | Arten |
|--------|-------|
| Versorgung | `power`, `ground` |
| Einzelsignal | `signal`, `digital`, `analog`, `pwm` |
| Bus | `bus`, `can`, `lin`, `spi`, `i2c`, `uart`, `ethernet` |
| Diagnose | `diagnostic`, `debug` |

Die Gruppe bestimmt die Linienform (siehe [05 Rendering](05-rendering-export.md#linienformen)),
die konkrete Art bestimmt Label-Vorgaben und später Plausibilitätsregeln.

### 4.3 Verbindungen

| Syntax | Bedeutung | Semantic Model |
|--------|-----------|----------------|
| `a -> b` | gerichtet a nach b | `source=a, target=b, direction=forward` |
| `a <- b` | gerichtet b nach a | normalisiert zu `source=b, target=a, direction=forward` |
| `a <-> b` | bidirektional | `direction=bidirectional` |
| `a -- b` | ungerichtet | `direction=none` |

- Endpunkt ohne Pin (`motor`) verbindet an den **Körper** der Komponente. Das Layout
  wählt dafür einen virtuellen Port auf der zur Flussrichtung passenden Seite.
- **Typableitung**, wenn `type` fehlt:
  1. beide Endpunkte Pins gleicher Art → diese Art,
  2. beide Pins, verschiedene Arten derselben Gruppe → Art des Quell-Pins,
  3. genau ein Endpunkt ist ein Pin → dessen Art,
  4. sonst `signal`.
- Pins aus verschiedenen Gruppen (z. B. `power` → `can`) ergeben `W201`, außer die
  Verbindung setzt `type` explizit.
- Verbindungen stehen in v0.1 nur auf `architecture`-Ebene.
- Mehrere Verbindungen zwischen denselben Endpunkten sind erlaubt und werden parallel geführt.

### 4.4 Zonen und Systeme

Beide gruppieren Komponenten, haben aber unterschiedliche Aufgaben:

| | `zone` | `system` |
|---|---|---|
| Zweck | **Layout**-Band entlang der Flussrichtung | **semantische** Grenze (ECU, Domäne, Fahrzeug) |
| Verschachtelung | nur auf oberster Ebene | beliebig, auch innerhalb von Zonen |
| Darstellung | beschriftetes Band mit dezentem Hintergrund | beschrifteter Rahmen |

- Die Struktur ist ein Baum: `architecture › zone › system* › component`.
- Zonen werden in Deklarationsreihenfolge entlang `direction` angeordnet
  (LR: Spalten von links nach rechts, TB: Zeilen von oben nach unten).
- Werden Zonen verwendet, muss **jede** Komponente in einer Zone liegen.
- Eine Komponente gehört dem innersten Block, in dem sie definiert ist. Referenzen auf
  anderswo definierte Komponenten gibt es in v0.1 nicht.

### 4.5 Layout-Steuerung

```sysarch
layout {
    mode assisted
    grid {
        battery | regulator | mcu | hb1
        .       | .         | wdg | motor
    }
}
```

- `direction LR | TB` — Hauptflussrichtung, Standard `LR`.
- `mode strict` (Standard): Der Renderer entscheidet alles; `hint`s erzeugen eine Warnung
  und werden ignoriert; der visuelle Editor erlaubt kein Verschieben.
- `mode assisted`: Komponenten dürfen im Editor verschoben werden. Das Ergebnis wird als
  `hint row N` / `hint column N` in die DSL geschrieben — nie als Pixel.
- `grid` legt Spalte und Zeile im **fertigen Bild** fest (unabhängig von `direction`).
  `.` ist eine leere Zelle. Nicht aufgeführte Komponenten platziert das Layout automatisch.
- `hint row|column` (1-basiert) hat dieselbe Bedeutung für eine einzelne Komponente.
- Grid und Hints dürfen Zonen-Zusammenhang nicht verletzen (sonst Fehler `E108`).

### 4.6 Templates (`define`)

```sysarch
define half_bridge {
    label "Half Bridge"
    category power
    size medium
    left   { pin power VS   pin digital IN }
    right  { pin power OUT }
    bottom { pin analog IS   pin ground GND }
}
```

- Templates beschreiben Vorgaben für Label, Kategorie, Größe, Form, Icon und Pins —
  **keine Geometrie**.
- `extends` erbt Pins und Vorgaben; Pins werden angehängt, Vorgaben überschrieben.

#### Formen

`shape` wählt aus einer **festen Liste**. Jede Form hat eine definierte Kontur, an der
Pins andocken, und einen Innenbereich für Label und Icon
(Details in [04 Layout](04-layout.md#formen-und-pins)).

| Form | Darstellung | typische Verwendung |
|------|-------------|---------------------|
| `rounded` | Rechteck mit Theme-Radius (Standard) | Steuergeräte, Controller, Treiber |
| `rect` | Rechteck ohne Radius | externe Systeme, Stecker |
| `circle` | Kreis (quadratische Hülle) | Motoren, Sensoren, Masse |
| `hexagon` | Sechseck, Spitzen links/rechts | Software-Komponenten, Gateways |
| `cylinder` | Zylinder | Speicher, Datenablagen |

#### Icons

`icon <name>` referenziert ein Icon aus der **Icon-Bibliothek** (`library/icons/`).
Icons sind einfarbige Symbole, das Theme färbt sie in der Textfarbe der Kategorie.
Das Diagramm kann keine Bilddateien, URLs oder eigene Grafiken einbinden
(siehe [05 Rendering](05-rendering-export.md#icons)).

```sysarch
define motor extends actuator {
    label "Motor"
    shape circle
    icon motor
}

define window_motor extends motor {
    icon window
}
```
- Die mitgelieferte Bibliothek ([`library/automotive.archlib`](../library/automotive.archlib))
  ist selbst in dieser Syntax geschrieben und wird vor jedem Dokument geladen.
- Dokument-lokale `define`s stehen vor `architecture` und überschreiben Bibliotheksnamen
  mit einer Warnung.

### 4.7 Reservierte Konstrukte (Parser meldet „ab v0.x verfügbar“)

`use "datei.archlib"` · `view <id>` · `show in <view>` · `interface` · `rule`

---

## 5. Diagnosen

Jede Diagnose hat Code, Schweregrad, Meldung und Quellbereich (Zeile/Spalte von–bis).
Codes sind stabil und dokumentiert, damit CI-Filter und Tests darauf aufbauen können.

| Code | Stufe | Auslöser |
|------|-------|----------|
| `E001` | Fehler | Syntaxfehler (erwartetes Token, gefundenes Token) |
| `E101` | Fehler | doppelte Komponenten-ID |
| `E102` | Fehler | unbekannte Komponente in Verbindung, Grid oder Hint |
| `E103` | Fehler | unbekannter Pin — mit Vorschlag per Levenshtein („meintest du `CAN_TX`?“) |
| `E104` | Fehler | unbekanntes Template |
| `E105` | Fehler | doppelter Pin-Name bzw. Neudeklaration mit anderer Art |
| `E106` | Fehler | Komponente außerhalb einer Zone, obwohl Zonen verwendet werden |
| `E107` | Fehler | Komponente mehrfach im Grid oder Grid-Zeilen unterschiedlich breit |
| `E108` | Fehler | Grid/Hint verletzt Zonen-Zusammenhang |
| `E109` | Fehler | unbekannte Signalart, Kategorie oder unbekanntes Theme |
| `E110` | Fehler | reserviertes Konstrukt aus späterer Version |
| `E111` | Fehler | unbekannte Form oder unbekanntes Icon — mit Vorschlag per Levenshtein |
| `W201` | Warnung | Verbindung zwischen Pins unverträglicher Gruppen (z. B. `power` → `can`) |
| `W202` | Warnung | `hint` in `mode strict` |
| `W203` | Warnung | lokales `define` überschreibt Bibliotheks-Template |
| `I301` | Hinweis | Pin ohne Verbindung |

**Fehlertoleranz:** Der Parser synchronisiert nach einem Fehler auf die nächste `}` bzw.
das nächste Anweisungs-Schlüsselwort und liefert ein Teil-AST. Die Vorschau zeigt den
letzten fehlerfreien Stand plus Diagnosen — sie wird nie leer, nur weil gerade getippt wird.

---

## 6. Kanonische Formatierung

`sysarch fmt` erzeugt eine eindeutige Schreibweise (4 Leerzeichen, Reihenfolge
`theme` › `direction` › `layout` › Zonen/Systeme/Komponenten › Verbindungen,
Einzeiler-Blöcke für Verbindungen mit höchstens zwei Eigenschaften). Kommentare bleiben
erhalten. Der visuelle Editor nutzt dieselben Regeln für eingefügten Text.
