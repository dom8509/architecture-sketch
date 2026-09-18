# Installation

sysarch comes in three forms. All of them use the same core and produce the same picture.

| | Web app | Obsidian plugin | CLI |
|---|---|---|---|
| Use case | try it out, sketch quickly, share | architecture inside notes | scripts, CI, bulk export |
| Installation | none | BRAT or manual | from the repository |
| Exports | SVG, PNG, React Flow | SVG, PNG, React Flow | SVG, PNG, React Flow |

## Web app

The web app runs in the browser without any installation: <a href="/sysarch/app/" target="_blank">open sysarch ↗</a>.
It needs no server — drafts stay in the browser's local storage, and shared links carry the
source text itself.

To run it locally from the repository:

```sh
git clone https://github.com/dom8509/sysarch.git
cd sysarch
npm install
npm run web        # http://localhost:5173
```

## Obsidian plugin

### Via BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs plugins straight from GitHub
releases and keeps them up to date.

1. In Obsidian, open **Settings → Community plugins**, then install and enable BRAT.
2. Command palette: **BRAT: Add a beta plugin for testing**.
3. Enter the repository `dom8509/sysarch` and confirm.
4. Enable the **sysarch** plugin under **Community plugins**.

New versions are fetched with **BRAT: Check for updates to all beta plugins**.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/dom8509/sysarch/releases/latest).
2. Create the folder `.obsidian/plugins/sysarch/` in your vault and put the three files there.
3. Reload Obsidian and enable **sysarch** under **Community plugins**.

### From the repository

```sh
npm run obsidian:install -- ~/path/to/vault
```

This builds the plugin and copies it into the vault. How to use it is described under
[Obsidian](/guides/obsidian).

## CLI

The CLI requires **Node.js 22** or newer and is built from the repository:

```sh
git clone https://github.com/dom8509/sysarch.git
cd sysarch
npm install
npm run build

npm run sysarch -- --version
npm run sysarch -- render examples --out build/examples
```

`npm run sysarch -- …` invokes `node apps/cli/dist/main.js …`. All commands and options are
listed in the [CLI reference](/reference/cli); using them in pipelines is covered by
[CLI and CI](/guides/cli-and-ci).
