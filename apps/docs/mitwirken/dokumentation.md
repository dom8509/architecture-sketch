# Dokumentation pflegen

Diese Seite liegt in [`apps/docs`](https://github.com/dom8509/sysarch/tree/main/apps/docs) und wird
mit [VitePress](https://vitepress.dev) gebaut. Bei jedem Push auf `main` wird sie zusammen mit der
Web-App neu gebaut und auf GitHub Pages veröffentlicht.

## Lokal ansehen

```sh
npm install
npm run docs          # Entwicklungsserver, http://localhost:5173/sysarch/
npm run docs:build    # Doku + Web-App wie auf GitHub Pages nach apps/docs/.vitepress/dist
```

## Was von Hand geschrieben wird und was nicht

| Quelle | Seiten |
|--------|--------|
| **von Hand** in `apps/docs/` | Startseite, Einstieg, Anleitungen, Sprache, Diagnosen, CLI-Optionen |
| **aus `docs/`** übernommen | alle Konzeptseiten — bearbeitet wird nur `docs/*.md` |
| **aus dem Code erzeugt** | Bibliothek, Icons, Themes, Signalarten, Beispiele, CLI-Hilfe, alle Diagrammbilder |

Das Skript `apps/docs/scripts/generate.ts` erzeugt vor jedem Start und Build alles aus der
dritten Zeile. Nichts davon wird eingecheckt.

## ```sysarch-Blöcke

- Ein Block mit `architecture "…"` wird beim Build **gerendert** — hell und dunkel, wenn er kein
  `theme` setzt — und bekommt den Link **In der Web-App öffnen**.
- **Fehler und Warnungen brechen den Build.** Ein Beispiel in der Doku kann also nicht still
  veralten, wenn sich die Sprache ändert.
- Ausschnitte ohne `architecture` werden nur hervorgehoben.
- `sysarch nur-code` rendert nicht und prüft nicht — für absichtlich fehlerhafte Beispiele.
- Die Hervorhebung nutzt denselben Lexer wie der Editor.

## Was die Tests prüfen

`apps/docs/test/docs.test.ts` läuft mit `npm test` und damit in jeder CI:

- jede Diagnose aus dem Code hat einen Abschnitt unter [Diagnosen](/referenz/diagnosen)
- jeder Obsidian-Befehl, jede Einstellung und jeder Menüeintrag steht in der
  [Obsidian-Anleitung](/anleitungen/obsidian)
- jede Schaltfläche der Web-App steht in der [Web-App-Anleitung](/anleitungen/web-app)
- jede Option der CLI steht in der [CLI-Referenz](/referenz/cli)
- jede Sidebar-Seite existiert, und jede Seite steht in der Sidebar
- alle gerenderten Diagramme sind fehlerfrei und kanonisch formatiert (`sysarch fmt`)

## Checkliste für Änderungen

Ändert ein Pull Request etwas, das Nutzer sehen — Sprache, Bibliothek, CLI, Web-App oder
Obsidian —, gehört die Doku in denselben PR:

- neue oder geänderte Syntax: [Sprache](/referenz/sprache), die passende Anleitung und `docs/02-dsl.md`
- neuer Diagnosecode: Abschnitt unter [Diagnosen](/referenz/diagnosen)
- neues Theme: Beschreibung in `THEME_DESCRIPTIONS` (`scripts/generate.ts`) — sonst bricht der Build
- neue Kategorie oder Signalgruppe: Überschrift in `CATEGORY_TITLES` bzw. `GROUP_TITLES`
- neue Obsidian-Funktion, Web-App-Schaltfläche oder CLI-Option: die jeweilige Anleitung
