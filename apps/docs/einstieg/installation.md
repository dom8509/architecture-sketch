# Installation

sysarch gibt es in drei Formen. Alle nutzen denselben Kern und erzeugen dasselbe Bild.

| | Web-App | Obsidian-Plugin | CLI |
|---|---|---|---|
| Einsatz | ausprobieren, schnell skizzieren, teilen | Architektur in Notizen | Skripte, CI, Massenexport |
| Installation | keine | BRAT oder manuell | aus dem Repository |
| Exporte | SVG, PNG, React Flow | SVG, PNG, React Flow | SVG, PNG, React Flow |

## Web-App

Die Web-App läuft ohne Installation im Browser: <a href="/sysarch/app/" target="_blank">sysarch öffnen ↗</a>.
Sie braucht keinen Server — Entwürfe bleiben im lokalen Speicher des Browsers, geteilte
Links enthalten den Quelltext selbst.

Lokal startest du sie aus dem Repository:

```sh
git clone https://github.com/dom8509/sysarch.git
cd sysarch
npm install
npm run web        # http://localhost:5173
```

## Obsidian-Plugin

### Über BRAT (empfohlen)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installiert Plugins direkt aus
GitHub-Releases und hält sie aktuell.

1. In Obsidian **Einstellungen → Community-Plugins** öffnen und BRAT installieren und aktivieren.
2. Befehlspalette: **BRAT: Add a beta plugin for testing**.
3. Repository `dom8509/sysarch` eintragen und bestätigen.
4. Unter **Community-Plugins** das Plugin **sysarch** aktivieren.

Neue Versionen holst du mit **BRAT: Check for updates to all beta plugins**.

### Manuell

1. Aus dem [neuesten Release](https://github.com/dom8509/sysarch/releases/latest) die Dateien
   `main.js`, `manifest.json` und `styles.css` herunterladen.
2. Im Vault den Ordner `.obsidian/plugins/sysarch/` anlegen und die drei Dateien hineinlegen.
3. Obsidian neu laden und **sysarch** unter **Community-Plugins** aktivieren.

### Aus dem Repository

```sh
npm run obsidian:install -- ~/Pfad/zum/Vault
```

Baut das Plugin und kopiert es in den Vault. Wie du es benutzt, steht unter
[Obsidian](/anleitungen/obsidian).

## CLI

Die CLI braucht **Node.js 22** oder neuer und wird aus dem Repository gebaut:

```sh
git clone https://github.com/dom8509/sysarch.git
cd sysarch
npm install
npm run build

npm run sysarch -- --version
npm run sysarch -- render examples --out build/examples
```

`npm run sysarch -- …` ruft `node apps/cli/dist/main.js …` auf. Alle Befehle und Optionen
stehen in der [CLI-Referenz](/referenz/cli), den Einsatz in Pipelines beschreibt
[CLI und CI](/anleitungen/cli-und-ci).
