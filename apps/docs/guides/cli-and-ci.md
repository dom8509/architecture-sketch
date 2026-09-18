# CLI and CI

The CLI checks, formats and renders diagrams in scripts and pipelines. Its output is
byte-identical with the web app and Obsidian. Installation:
[CLI](/getting-started/installation#cli).

In the examples, `sysarch` stands for `npm run sysarch --` or `node apps/cli/dist/main.js`.

## Checking

```sh
sysarch check architecture/                   # exit 1 on errors
sysarch check architecture/ --max-warnings 0  # warnings fail the run as well
sysarch check architecture/ --verbose         # hints (I…) on top
sysarch check architecture/ --format json     # machine-readable, incl. end position and suggestions
```

Directories are searched recursively for `.arch` and `.archlib`. The messages use the compiler
format `file:line:column: level CODE: message` that editors and CI systems understand.

## Formatting

```sh
sysarch fmt architecture/          # formats in place
sysarch fmt architecture/ --check  # only reports unformatted files (exit 1)
sysarch fmt - < door.arch          # stdin → stdout, e.g. for editor integrations
```

`fmt` produces one canonical spelling: four spaces of indentation, a fixed order of sections,
aligned one-liners. Comments are preserved; files with syntax errors are left untouched. The
rules are in the [language specification](/concept/02-dsl#_6-canonical-formatting).

## Rendering

```sh
sysarch render door.arch                              # door.svg next to the source
sysarch render architecture/ --out build/             # all files into build/
sysarch render door.arch --format png --scale 3       # door.png at 3×
sysarch render door.arch --format reactflow --out -   # React Flow JSON to stdout
sysarch render door.arch --theme technical --out door-print.svg
```

Files with errors are not rendered; the exit code is 1 in that case.

## In GitHub Actions

A workflow that checks on every push whether all diagrams are valid and formatted, and stores
the rendered images as an artifact:

```yaml
name: Architecture

on: [push, pull_request]

jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Build sysarch
        run: |
          git clone --depth 1 https://github.com/dom8509/sysarch.git "$RUNNER_TEMP/sysarch"
          cd "$RUNNER_TEMP/sysarch" && npm ci && npm run build

      - name: Check and render
        run: |
          sysarch() { node "$RUNNER_TEMP/sysarch/apps/cli/dist/main.js" "$@"; }
          sysarch check architecture --max-warnings 0
          sysarch fmt architecture --check
          sysarch render architecture --out build/diagrams
          sysarch render architecture --format png --out build/diagrams

      - uses: actions/upload-artifact@v4
        with:
          name: diagrams
          path: build/diagrams
```

::: tip Keeping diagrams in the repository up to date
If the pipeline renders the SVGs and compares them with the checked-in files (`cmp` or
`git diff --exit-code`), every forgotten update shows up. sysarch itself checks its examples
against `tests/golden/` this way.
:::

## Exit codes

| Code | Meaning |
|------|-----------|
| `0` | everything fine |
| `1` | diagnostics reported or the check failed |
| `2` | usage or file error |
