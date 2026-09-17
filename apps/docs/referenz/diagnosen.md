# Diagnosen

Jede Diagnose hat einen stabilen **Code**, eine **Stufe**, eine Meldung und eine Position.
Die Codes ändern sich nicht, damit CI-Filter und Tests darauf aufbauen können.

| Stufe | Präfix | Wirkung |
|-------|--------|---------|
| Fehler | `E…` | kein Diagramm; die Vorschau zeigt den letzten gültigen Stand; `check` endet mit Exit 1 |
| Warnung | `W…` | Diagramm wird gezeichnet; `check --max-warnings 0` bricht ab |
| Hinweis | `I…` | nur zur Information; in der CLI nur mit `--verbose` |

## E001

**Syntaxfehler** — ein Token fehlt oder steht an der falschen Stelle.

```sysarch nur-code
architecture "A" {
    component mcu microcontroller
}
```

Meldung: „Unbekannte Anweisung `microcontroller` in der Architektur“ — hier fehlt der Doppelpunkt vor
dem Template. Der Parser fängt sich an der nächsten Anweisung wieder und meldet weitere Fehler.

## E101

**Doppelte ID** — eine Komponente, Zone oder ein System heißt wie ein anderes Element, oder ein
Template ist zweimal definiert.

```sysarch nur-code
component mcu: microcontroller
component mcu: soc
```

IDs sind im ganzen Dokument eindeutig, auch über Zonen und Systeme hinweg. Benenne eines der
Elemente um.

## E102

**Unbekannte Komponente** in einer Verbindung, im Grid oder in einem Hint.

```sysarch nur-code
component mcu: microcontroller
mcu -> can
```

Lege die Komponente an oder korrigiere die ID.

## E103

**Unbekannter Pin** — mit Vorschlag, wenn ein ähnlicher Name existiert.

```sysarch nur-code
component mcu: microcontroller { pin pwm MOTOR_PWM }
mcu.MOTOR_PMW -> driver.IN
```

Meldung: „Komponente `mcu` hat keinen Pin `MOTOR_PMW` — meintest du `MOTOR_PWM`?“ Unbekannte Pins werden
bewusst nicht automatisch angelegt. In der Web-App legt der Quick-Fix den Pin mit einem Klick an.

## E104

**Unbekanntes Template** oder zyklisches `extends`.

```sysarch nur-code
component mcu: microcontroler
```

Meldung: „Unbekanntes Template `microcontroler` — meintest du `microcontroller`?“ Alle Templates stehen in
der [Bibliothek](./bibliothek).

## E105

**Doppelter Pin** oder **Neudeklaration mit anderer Art**.

```sysarch nur-code
component hb: half_bridge {
    right { pin digital VS }
}
```

`VS` ist im Template `half_bridge` ein `power`-Pin. Eine Neudeklaration darf nur die Seite
ändern, nicht die Art.

## E106

**Komponente außerhalb einer Zone**, obwohl das Dokument Zonen verwendet.

Verschiebe die Komponente in eine Zone oder verzichte ganz auf Zonen — siehe
[Zonen und Systeme](/anleitungen/zonen-und-systeme).

## E107

**Ungültiges Grid** — die Zellen einer Komponente bilden kein lückenloses Rechteck, oder die
Zeilen sind unterschiedlich breit.

```sysarch nur-code
grid {
    a | b | a
}
```

Eine Komponente darf mehrere Zellen belegen, aber nur benachbarte, die zusammen ein Rechteck
bilden.

## E108

**Grid oder Hint reißt eine Zone auseinander.**

Alle Komponenten einer Zone müssen in Flussrichtung vor denen der nächsten Zone liegen. Passe
das Grid an die Reihenfolge der Zonen an.

## E109

**Unbekannte Signalart, Kategorie oder unbekanntes Theme** — mit Vorschlag, wenn möglich.

```sysarch nur-code
theme dark
component mcu: microcontroller { pin cann TX }
```

Die gültigen Werte stehen in der [Sprachreferenz](./sprache) und unter [Themes](./themes).

## E110

**Reserviertes Konstrukt** aus einer späteren Version: `use`, `view`, `show in`, `interface`,
`rule`.

Meldung: „`use` ist erst ab v0.2 verfügbar“ — siehe [Roadmap](/konzept/08-roadmap).

## E111

**Unbekannte Form oder unbekanntes Icon** — mit Vorschlag.

```sysarch nur-code
define m {
    shape square
    icon motr
}
```

Formen: `rounded`, `rect`, `circle`, `hexagon`, `cylinder`. Icons: siehe [Icons](./icons).

## W201

**Verbindung zwischen unverträglichen Signalarten**, etwa `power` → `can`.

Meist ein vertauschter Pin. Ist die Verbindung gewollt, setze `type` ausdrücklich — dann
entfällt die Warnung.

## W202

**`hint` in `mode strict`** — der Hint wird ignoriert.

Setze `layout { mode assisted }` oder entferne den Hint.

## W203

**Lokales Template überschreibt ein Bibliotheks-Template** mit gleichem Namen.

Soll die Bibliothek nur erweitert werden, wähle einen neuen Namen und leite mit `extends` ab.

## I301

**Pin ohne Verbindung.**

Nur ein Hinweis: Bibliotheks-Templates bringen oft mehr Pins mit, als ein Diagramm braucht. Mit
`pins connected` oder `pins none` entfällt der Hinweis — siehe
[Präsentationssichten](/anleitungen/praesentation#pins-ausblenden).
