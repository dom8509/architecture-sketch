# Schnellstart

In zehn Minuten vom leeren Editor zu einem Diagramm mit Pins, Verbindungen und Zonen. Du
brauchst nichts zu installieren.

## 1. Editor öffnen

Öffne die <a href="/sysarch/app/" target="_blank">Web-App ↗</a>. Links steht der Quelltext,
rechts die Live-Vorschau, unten die Diagnosen. Klicke auf **Neu**, um mit einer leeren
Architektur zu beginnen.

::: tip Lieber in Obsidian?
Installiere das Plugin wie unter [Installation](./installation#obsidian-plugin) beschrieben
und schreibe die Beispiele in einen Codeblock mit der Sprache `sysarch`. Jedes Beispiel auf
dieser Seite hat außerdem den Link **In der Web-App öffnen**.
:::

## 2. Die erste Komponente

Jedes Diagramm ist eine `architecture` mit einem Titel. Darin legst du Komponenten an:
`component <id>: <template>`. Das Template kommt aus der
[Bibliothek](/referenz/bibliothek) und bestimmt Form, Icon, Farbe und Standard-Pins.

```sysarch
architecture "Fensterheber" {
    component mcu: microcontroller { label "S32K344" }
}
```

- `mcu` ist die **ID** — damit verweist du später auf die Komponente.
- `label` ist der angezeigte Name. Ohne `label` zeigt sysarch das Label des Templates.

## 3. Komponenten verbinden

Verbindungen stehen am Ende der Architektur. `a -> b` zeichnet einen Pfeil von `a` nach `b`.
Wohin die Komponenten kommen und wie die Leitung läuft, entscheidet das Layout.

```sysarch
architecture "Fensterheber" {
    component mcu: microcontroller { label "S32K344" }
    component driver: half_bridge { label "Motor Driver" }
    component motor: motor { label "Window Motor" }

    mcu -> driver.IN
    driver.OUT -> motor
}
```

`driver.IN` und `driver.OUT` sind **Pins** — die Halbbrücke bringt sie aus ihrem Template mit.
Ohne Pin (`motor`) dockt die Leitung am Körper der Komponente an.

## 4. Eigene Pins und Signalarten

Pins deklarierst du mit `pin <art> <NAME>`. Die Art bestimmt die Linienform: Versorgung ist
dick, Busse sind doppelt, Diagnose ist gestrichelt. Mit `label` beschriftest du Verbindungen,
mit `type` legst du die Art einer Verbindung fest.

```sysarch
architecture "Fensterheber" {
    component battery: battery { label "KL30" }
    component mcu: microcontroller {
        label "S32K344"
        pin power VDD
        pin pwm MOTOR_PWM
        pin analog MOTOR_IS
    }
    component driver: half_bridge { label "Motor Driver" }
    component motor: motor { label "Window Motor" }

    battery -> mcu.VDD         { label "12 V" }
    mcu.MOTOR_PWM -> driver.IN { label "PWM" }
    driver.IS -> mcu.MOTOR_IS  { label "Strom" }
    driver.OUT -> motor        { label "Motor" type power }
}
```

Auf welcher Seite ein Pin sitzt, leitet sysarch aus den Verbindungen ab. Alle Signalarten
stehen unter [Pins und Verbindungen](/anleitungen/pins-und-verbindungen).

## 5. Mit Zonen gliedern

Zonen sind Bänder entlang der Flussrichtung. Sobald du eine Zone verwendest, muss jede
Komponente in einer Zone liegen.

```sysarch
architecture "Fensterheber" {
    direction LR

    zone supply {
        label "Versorgung"
        component battery: battery { label "KL30" }
    }

    zone control {
        label "Steuerung"
        component mcu: microcontroller {
            label "S32K344"
            pin power VDD
            pin pwm MOTOR_PWM
            pin analog MOTOR_IS
        }
    }

    zone output {
        label "Aktorik"
        component driver: half_bridge { label "Motor Driver" }
        component motor: motor { label "Window Motor" }
    }

    battery -> mcu.VDD         { label "12 V" }
    mcu.MOTOR_PWM -> driver.IN { label "PWM" }
    driver.IS -> mcu.MOTOR_IS  { label "Strom" }
    driver.OUT -> motor        { label "Motor" type power }
}
```

## 6. Fehler lesen

Vertippst du dich, zeigt die Vorschau weiter den letzten gültigen Stand, und die Diagnose
nennt Zeile, Spalte, Code und meist einen Vorschlag. So meldet es `sysarch check`:

```sysarch nur-code
architecture "Fensterheber" {
    component mcu: microcontroller { pin pwm MOTOR_PWM }
    component driver: half_bridge

    mcu.MOTOR_PMW -> driver.IN
}
```

```text
fensterheber.arch:5:9: error E103: Komponente `mcu` hat keinen Pin `MOTOR_PMW` — meintest du `MOTOR_PWM`?
```

In der Web-App übernimmst du den Vorschlag direkt im Editor. Alle Codes erklärt die Seite
[Diagnosen](/referenz/diagnosen).

## 7. Exportieren und teilen

In der Werkzeugleiste der Web-App:

- **SVG**, **PNG** (1×, 2×, 3×) und **React Flow** laden das Diagramm herunter.
- **Link teilen** kopiert einen Link, der den Quelltext enthält — ohne Server.
- **Speichern** legt eine `.arch`-Datei ab, die du versionieren kannst.

## Wie geht es weiter?

- [Installation](./installation) — Obsidian-Plugin und CLI einrichten
- [Anleitungen](/anleitungen/) — Layout steuern, Präsentationssichten, eigene Templates, CI
- [Bibliothek](/referenz/bibliothek) — alle mitgelieferten Bausteine
