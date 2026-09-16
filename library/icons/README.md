# Icon-Bibliothek

Ein Icon pro Datei, Dateiname = Icon-Name (`motor.svg` → `icon motor`).

Regeln (werden beim Build geprüft, Verstöße brechen den Build):

- `viewBox="0 0 24 24"`, einfarbig, keine festen Farben
- erlaubt: `path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `g`
- verboten: `image`, `text`, externe `use`-Referenzen, `style`, `script`, Filter, Verläufe, Masken
- Strichstärke und Farbe setzt das Theme

Der mitgelieferte Satz ist in [05 Rendering & Export](../../docs/05-rendering-export.md#icons)
aufgelistet. `npm run build:icons` prüft die Dateien und bettet sie zusammen mit
`automotive.archlib` in `@sysarch/core` ein.
