# 04 — Layout & Routing

Layout is the hardest part. sysarch therefore does **not** solve general graph layout, but
a narrowly defined problem: technical architecture diagrams with a main flow direction,
zones, system boundaries, pins and orthogonal connections.

Guiding principle: 80 % from clear rules plus declarative overrides (`grid`, `hint`)
beats a research project.

All algorithms are our own code, without Dagre, ELK or Graphviz. Every iteration has a
fixed order (declaration order as the tie-breaker) — **no random numbers, no hash-map
iteration over unsorted keys**.

---

## Phases

```
ArchitectureModel
   │ 1. Ranks          component → column along the flow direction
   │ 2. Zones          make the ranks of each zone contiguous
   │ 3. Order          position across the flow, reduce crossings
   │ 4. Overrides      apply grid / hint
   │ 5. Sizes          measure text, count pins, round box size to the grid
   │ 6. Coordinates    ranks and rows to pixels, compute group frames
   │ 7. Routing        orthogonal paths from pin to pin
   │ 8. Labels         place connection labels
   ▼
SceneGraph
```

The following assumes `direction LR`. For `TB`, x and y are swapped at the end; all
phases work in the abstract axes *main* (flow) and *cross*.

---

## 1. Ranks

- Graph: components as nodes, connections as edges.
  `forward` points from source to target. `bidirectional` and `none` count as an edge in
  declaration direction, but with half the weight.
- **Break cycles** (e.g. the feedback `hb1.IS -> mcu`): depth-first search in declaration
  order; back edges are reversed for the rank computation and later routed as feedback
  paths.
- **Rank** = longest path from a source. Then compaction: nodes without predecessors move
  as close as possible to their first successor.
- Unconnected components get a **rank of their own at the end of their zone**. Rank 0
  would change the rank width and thus every following position, violating the stability
  test (see below). Ranks are filled across from the top, not centred — for the same
  reason.

## 2. Zones

Zones are contiguous rank ranges in declaration order:

```
Zone supply    │ Zone processing │ Zone actuation
Rank 0 … 1     │ Rank 2          │ Rank 3 … 4
```

- Ranks are computed **per zone** (only intra-zone edges count) and then chained one
  after another.
- Edges between zones that run against the zone order are allowed and are routed as
  feedback paths.

## 3. Order within a rank

- Initial order: declaration order.
- **Barycenter heuristic**, fixed number of passes (4× forward/backward). A node's
  position = the mean of the positions of its neighbours in the adjacent rank — at
  **pin level**, not node level: a pin further down on the MCU pulls the neighbour down.
- **Systems as clusters:** the members of a system stay contiguous in every rank. Sorting
  happens first within the innermost group, then the groups are ordered as blocks by
  their mean barycenter.
- Ties → declaration order. As a result, adding an unconnected component at the end of
  the file does not change the result.

## 4. Overrides

- `grid`: row/column in the final image. Columns determine the rank (with `LR`), rows the
  order. Listed components are fixed, the rest are inserted around them in phases 1–3.
- **Spanned cells** (the same ID in a rectangle of cells): the component occupies ranks
  `rank … rank + n − 1` or rows `slot … slot + n − 1`.
  - Rank widths only count components without a span; if the sum of the spanned ranks
    plus their spacing is not enough for the natural width, the last spanned rank grows.
    The hull is then stretched to the full extent, and pins on the top/bottom are spread
    over the new width.
  - Across the flow, the component reaches down to the bottom edge of its last row; only
    that last row pushes the following rows down.
  - Free components in covered ranks move aside across the flow.
  - After placement, body attachments on connections involving a spanning component are
    recomputed from the actual geometry: the counterpart takes the centre of its side
    (avoiding group labels), and the spanning component takes the point exactly opposite.
    Lines to neighbours above and below therefore run without a bend.
- Fixed rows take precedence over pin alignment: a node aligns only to a connection whose
  counterpart lies in the same row. The shared top edge of a row is derived from the
  minimum positions, not from aligned ones (otherwise rows drift further with every pass).
- `hint row|column`: like a grid entry for a single component.
- Conflicts (two components in the same cell) → error; layout falls back to automatic for
  the affected components.

## 5. Sizes

- Text widths come from **embedded font metrics** (advance widths + kerning pairs of the
  theme font as a generated table), not from `canvas.measureText`. Only this way is the
  geometry identical in the browser, in Obsidian and in Node.
- Component width = max(`minWidth[size]`, icon + spacing + label width + padding, widest
  combination of pin labels left + right + minimum spacing).
- Component height = max(`minHeight[size]`, label + padding, pins per side × pin spacing).
- Pin spacing = `layout { pin spacing N }` × grid, otherwise `pinPitch` of the theme.
- Body ports (connections without a pin) are counted like pins: a side must hold
  `(pins + body ports + 1) × pin spacing`, otherwise the component grows after the ports
  have been assigned and the ports are spread again.
- All sizes are **rounded up to the grid** (16 px by default).
- Pins sit on grid points. Pins on the left/right are distributed evenly around the centre
  of the area below the header (icon + label), pins on the top/bottom around the centre of
  the side; their labels sit inside, along the respective side.
- Sizing is computed for the **inner area** of the shape (see below); the hull is derived
  back from it.
- Labels wider than three times `minWidth` (for `circle`: one times, because circles grow
  in both directions) are wrapped at word boundaries; no truncation, no font shrinking.
- After the minimum size and rounding, a check verifies that the inner area still holds
  the content (for the hexagon, the tip depth grows with the height); otherwise the hull
  grows further.

### Shapes and pins

Every shape provides three functions shared by layout and renderer:

```ts
interface ShapeGeometry {
  /** Inner area for icon + label, relative to the hull. */
  inner(hull: Rect): Rect;
  /** Smallest hull whose inner area holds `content`. */
  hullFor(content: Size, pinsPerSide: Record<Side, number>): Size;
  /** Point on the contour for a pin on side `side` at cross coordinate `t`. */
  contour(hull: Rect, side: Side, t: number): Point;
}
```

| Shape | Inner area | Hull | Pins |
|------|--------------|-------|------|
| `rounded`, `rect` | hull minus padding | free | on the border |
| `circle` | inscribed square (≈ 0.71 × diameter) | square | intersection of the pin line with the circle |
| `hexagon` | centre rectangle between the tips | free, tips = ¼ height | left/right on the slopes, top/bottom on the edges |
| `cylinder` | body between the ellipses | free, ellipse height = 1 grid unit | top/bottom on the ellipse, left/right on the border |

- **Pin positions stay on the hull.** If the contour lies inside the hull (circle,
  hexagon), the renderer draws a short stub from the contour to the hull edge. Routing and
  channel allocation therefore look the same for all shapes and need no special cases.
- For `circle` with more than three pins per side, the diameter grows until the stubs are
  at most half a hull width long.
- Icon and label are centred in the inner area: icon to the left of the label, with
  `size small` and `circle` the icon above the label.
- **Multiple elements** (`count` > 1): the hull grows by half a grid unit towards the top
  and the right. Inside it, the front card sits at the bottom left, with one card behind it
  (for 2) or two (from 3), each offset towards the top right. The inner area and the
  contour belong to the front card, pins stay on the hull as with all shapes; at the top
  and on the right a stub bridges the stack. The count "×n" belongs to the header and is
  included in the width measurement.

## 6. Coordinates

- Rank width = the widest component of the rank; components are centred within the rank.
- Spacing: `nodeGapMain` between ranks, `nodeGapCross` between components, `zoneGap`
  between zones. The gap between two ranks grows by one grid unit for every connection
  that has to run vertically there (channel width).
- **Pin alignment:** if a node has exactly one connection to the preceding rank, it is
  shifted across the flow so that the connection runs straight — provided this causes no
  overlap.
- Group frame = the hull of its members + `groupPadding` + room for the group label.
  Nested systems add their own padding.

## 7. Orthogonal routing

No Bézier curves. Only horizontal and vertical segments:

```
mcu ●─────────┐
              │
              └───────▶● hb1
```

**Procedure:**

1. Routing happens on the **layout grid** itself (all coordinates are multiples of the
   grid; diagrams of up to ~100 components stay small enough). Components block their grid
   points; frame lines, group labels and foreign pin stubs add extra cost. A sparse grid
   remains a possible optimisation.
2. Every connection starts with a stub perpendicular to the pin side (at least one grid
   unit).
3. **A\*** on the grid with cost = length + bend penalty (high) + crossing penalty
   (medium) + penalty for segments parallel to and coincident with already routed
   connections (very high).
4. Order of the connections: supply first, then buses, single signals, diagnostics; within
   a group, declaration order.
5. **Channel allocation:** parallel segments in the same gap get their own lanes one grid
   unit apart, enforced by the coincidence penalty. Connections that share a pin may
   overlap. Explicit sorting by target position is not implemented in v0.1.
6. **Feedback paths** (broken cycles) run around the outside of the components involved —
   below with `LR`, to the right with `TB`.
7. **Hops:** where a horizontal segment crosses a vertical one belonging to another
   connection, the horizontal one jumps over it with a semicircle (`markers.hop`). Every
   line and its arrow direction therefore stays unambiguously traceable. No hop between
   connections at the same attachment point and none directly at a bend.
8. Body attachments (a connection without a pin) get a virtual port on the side facing the
   counterpart; several ports on one side are distributed.

## 8. Connection labels

- Candidates: the middle of the longest segment, then the segment at the source pin, then
  the one at the target pin.
- The first candidate without overlap with components, pins or other labels wins.
- The label gets a halo in the background colour.
- The gap between two adjacent ranks is already sized in phase 6 so that the labels of
  direct connections fit in, end markers included. Further candidates lie one grid unit
  apart along all segments; if no free spot is found even then, the first candidate is
  used (no second layout pass).

---

## Limits of v0.1 (deliberate)

- No optimality. Crossings are reduced, not minimised.
- No connections that "tunnel" through system frames; they run over the frame border.
- No bundling of bus lines into a shared rail (candidate for v0.2: a `bus` component as a
  horizontal rail).
- No rule of its own for `external` components. They belong at the edge of the diagram, but
  the layout treats them like every other component — `grid` and `hint` place them
  ([02 DSL](02-dsl.md), section 4.2).
- Large diagrams (> 100 components) are not the target; views will cover that later.

## Testability

- **Golden files:** `examples/*.arch` → scene graph JSON and SVG are checked in; every
  layout change is visible as a diff in review.
- **Property tests:** no overlapping components, all paths orthogonal, all coordinates on
  the grid, paths do not intersect foreign components, label and icon lie completely
  inside the inner area of their shape.
- **Stability test:** adding an unconnected component at the end of the file must not
  change any existing position.
