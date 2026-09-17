# Eigene Templates

Ein Template legt fest, wie eine Art von Komponente aussieht: Label, Kategorie, Größe, Form,
Icon und Pins. Die [Bibliothek](/referenz/bibliothek) bringt die gängigen Bausteine mit;
eigene definierst du mit `define` **vor** der `architecture`.

## Ein Template anlegen

```sysarch
define sbc {
    label "System Basis Chip"
    category power
    size medium
    icon regulator
    left   { pin power VBAT   pin digital WAKE }
    right  { pin power VCC   pin can CANH   pin can CANL }
    bottom { pin digital RESET }
}

architecture "Eigenes Template" {
    component kl30: battery { label "KL30" }
    component sbc: sbc { label "FS26" }
    component mcu: microcontroller

    kl30 -> sbc.VBAT
    sbc.VCC -> mcu   { label "5 V" }
    sbc.RESET -> mcu { label "Reset" }
}
```

| Eigenschaft | Werte |
|-------------|-------|
| `label` | Standard-Label jeder Instanz |
| `category` | `power`, `controller`, `communication`, `sensor`, `actuator`, `software`, `external`, `generic` — wählt die Farbfamilie |
| `size` | `small`, `medium`, `large` |
| `shape` | `rounded` (Standard), `rect`, `circle`, `hexagon`, `cylinder` |
| `icon` | ein Name aus den [Icons](/referenz/icons); `icon none` entfernt ein geerbtes Icon |
| `pin`, `left`/`right`/`top`/`bottom` | Pins wie in einer Komponente |

Templates beschreiben **keine Geometrie** — Maße und Farben kommen immer aus dem Theme.

## Ein Template ableiten

`extends` übernimmt alles vom Basis-Template. Pins werden angehängt, alle anderen Vorgaben
überschrieben.

```sysarch
define window_motor extends motor {
    label "Window Motor"
    icon window
}

define rain_sensor extends sensor {
    label "Rain Sensor"
    right { pin lin LIN }
}

architecture "Abgeleitete Templates" {
    component bcm: microcontroller { label "BCM" }
    component motor: window_motor
    component rain: rain_sensor

    bcm -> motor { type pwm }
    rain.LIN -> bcm
}
```

## Form und Icon gehören ins Template

Eine Instanz kann `shape` und `icon` nicht setzen — damit gleiche Bausteine überall gleich
aussehen. Brauchst du für eine Komponente eine andere Darstellung, leite ein lokales Template
ab, wie `window_motor` oben.

## Bibliotheks-Templates überschreiben

Heißt ein lokales Template wie eines aus der Bibliothek, gilt das lokale, und sysarch warnt mit
[W203](/referenz/diagnosen#w203). Willst du das Bibliotheks-Template nur erweitern, leite mit
einem neuen Namen ab.

::: info Ausblick
Projektspezifische Bibliotheken in eigenen `.archlib`-Dateien, eingebunden mit `use`, sind für
v0.2 geplant ([Roadmap](/konzept/08-roadmap)). Bis dahin stehen eigene Templates im Dokument.
:::
