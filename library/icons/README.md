# Icon library

One icon per file, file name = icon name (`motor.svg` → `icon motor`).

Rules (checked at build time; violations break the build):

- `viewBox="0 0 24 24"`, single colour, no hard-coded colours
- allowed: `path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `g`
- forbidden: `image`, `text`, external `use` references, `style`, `script`, filters,
  gradients, masks
- stroke width and colour are set by the theme

The bundled set is listed in [05 Rendering & Export](../../docs/05-rendering-export.md#icons).
`npm run build:icons` validates the files and embeds them, together with
`automotive.archlib`, into `@sysarch/core`.
