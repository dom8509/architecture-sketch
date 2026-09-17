# sysarch

Architecture-as-Code für Embedded- und Systemarchitekturen. npm-Workspaces-Monorepo (`packages/*`, `apps/*`), Sprache der Doku, Kommentare und Commits: Deutsch.

## Befehle

- `npm run typecheck`, `npm test` — vor jedem Commit
- `npm run docs:build` — Dokumentation + Web-App bauen; bricht bei fehlerhaften Diagrammen in der Doku und toten Links
- `npm run docs` — Doku mit Live-Reload

## Dokumentation aktuell halten

Die Nutzerdoku (`apps/docs`, VitePress) wird bei jedem Push auf `main` auf GitHub Pages veröffentlicht (`.github/workflows/docs.yml`).

- Jede nutzerseitige Änderung — Syntax, Bibliothek, Diagnosen, CLI, Web-App, Obsidian-Plugin — aktualisiert `apps/docs` **im selben PR**: Referenz (`referenz/`) und die passende Anleitung (`anleitungen/`); Syntax- und Regeländerungen zusätzlich `docs/02-dsl.md`.
- `docs/*.md` (Konzept) wird beim Build nach `apps/docs/konzept/` kopiert — nur in `docs/` bearbeiten.
- Bibliothek, Icons, Themes, Signalarten, Beispiele, CLI-Hilfe und alle Diagrammbilder erzeugt `apps/docs/scripts/generate.ts` aus dem Code; neue Themes/Kategorien/Signalgruppen brauchen dort einen Text.
- ```` ```sysarch ````-Blöcke mit `architecture "…"` werden gerendert und müssen fehlerfrei, warnungsfrei und `sysarch fmt`-formatiert sein; absichtlich fehlerhafte Beispiele: ```` ```sysarch nur-code ````.
- `apps/docs/test/docs.test.ts` prüft Diagnosecodes, Obsidian-Befehle/Einstellungen/Menüs, Web-App-Schaltflächen, CLI-Optionen und die Sidebar gegen den Code.
