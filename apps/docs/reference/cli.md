# CLI

Guide with examples and a GitHub Actions workflow: [CLI and CI](/guides/cli-and-ci).

## Help

The output of `sysarch --help` — taken from the CLI on every build:

<!--@include: ../_generated/cli-help.md-->

## Commands

### `render`

| Option | Meaning |
|--------|-----------|
| `--out <directory>` | writes `<name>.<extension>` into the directory |
| `--out <file>` | writes exactly one input into this file; the extension has to match the format |
| `--out -` | writes to stdout (not for PNG) |
| without `--out` | writes next to the source file |
| `--format svg\|png\|reactflow` | extensions `.svg`, `.png`, `.reactflow.json`; default `svg` |
| `--scale 1\|2\|3` | PNG only, default `2` |
| `--theme <name>` | overrides the theme of the source |
| `--view <name>` | renders only this view; without it a document with views produces one file per view (`<name>-<view>.svg`) |

### `check`

| Option | Meaning |
|--------|-----------|
| `--max-warnings <n>` | exit 1 if more than `n` warnings occur |
| `--format text\|json` | text format `file:line:column: level CODE: message`, or JSON with end position and suggestions |
| `--verbose` | also shows hints (`I…`) in the text format |

Checks `.arch` files and `.archlib` libraries.

### `fmt`

| Option | Meaning |
|--------|-----------|
| `--check` | changes nothing, lists unformatted files and exits with 1 |
| `-` as input | reads from stdin and writes to stdout |

### General

| Invocation | Meaning |
|--------|-----------|
| `--help`, `-h`, `help` | show help |
| `--version`, `-v` | print the version |

## Inputs

Inputs are files or directories. Directories are searched recursively for `.arch` (and, for
`check` and `fmt`, `.archlib`); hidden folders and `node_modules` are skipped. Shell globbing
is therefore not needed.

## Exit codes

| Code | Meaning |
|------|-----------|
| `0` | everything fine |
| `1` | diagnostics reported or the check failed |
| `2` | usage or file error |
