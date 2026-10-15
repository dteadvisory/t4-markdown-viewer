# Wide Tables Capped at the Wide Measure, and the Toolbar Order Plan

> **Filed (2026-10-15):** both parts executed; shipped in 1.8.2 as 5a8dc56 (tables) and
> b7081ec (toolbar). The status below is as it stood before the go.
>
> **Status (2026-10-11):** final after the review loop; owner rulings R2 and R4 and the
> toolbar order recorded. Part 1 (tables) was built first as an uncommitted preview on the
> owner's PC (WebView2 only) and approved by eye ("looks good"); its diff is still uncommitted
> in the working tree. Part 2 (toolbar) is not built yet. Not to be executed until the
> owner's go.

**Goal:** a table wider than the reading column stops at 100ch (the wide measure) and wraps
its cells, instead of spreading to the window's edge. It goes wider only when its columns
can't fit 100ch even at their narrowest, and a column of longer text has a 12ch floor so it
never squeezes to a word a line. Narrow tables don't change.

**Builds on** `docs/archive/plans/reading-width-wide-step.md` (`--measure-wide`, shipped in 1.8.1).

**Spec:** the owner, 2026-10-11: "let's cap it at 100ch too but let it go wider when the
columns dont fit and are at their min width already, what can you suggest for a min width to
the columns?" Then, on the suggestion of a 12ch floor applied only to columns that wrap, "yes
lets try first in a build", and "looks good" on the preview.

## Current behaviour (main at 10685b9)

- `wrapTables` (`app.js:389`) puts each table in `div.table-scroll`.
- The wrapper steps out of the column with diagrams and pictures (`base.css`, the breakout
  rule): `width: max-content`, up to the pane less its padding, centred; at least the column's
  width (`.table-scroll { min-width: 100% }`), so a narrow table sits at the column's left
  edge. Past the pane it scrolls (`overflow-x: auto`).
- The table itself has no width: it is as wide as its content, up to the wrapper.
- Cells wrap only once the table meets the pane; then columns can shrink to their longest
  word, and nothing floors them.
- Themes only colour tables: none sets a table font size, a width or a `::before` (checked
  all 15 and `_template.css`).

## The change (as previewed)

`base.css`, the table rule:

```css
.markdown-body table {
  /* … existing … */
  font-size: 0.95em;
  /* As wide as its content, capped at the wide measure (in the document's ch; this font is
     0.95 of it), but never narrower than its columns at their floors: a table can't go below
     its min-content. Not `max-width: max-content`, which WebKit ignores on a table. */
  width: fit-content;
  max-width: calc(var(--measure-wide) / 0.95);
}

/* The floor of a column of longer text (`wrapTables`). */
.markdown-body th.floor::before {
  content: "";
  display: block;
  width: 12ch;
}
```

`app.js`, at the end of `wrapTables`' loop:

```js
// A column of longer text keeps a floor when the table is squeezed (`th.floor`); one of
// short values keeps its own width. ponytail: text length stands in for measured width.
const head = table.rows[0];
if (!head) return;
for (let j = 0; j < head.cells.length; j++)
  if ([...table.rows].some((r) => (r.cells[j]?.textContent.length ?? 0) > 14))
    head.cells[j].classList.add("floor");
```

- **How the width comes out** (as changed after R1's result): `fit-content` sizes the table to
  its content, `max-width` stops it at 100ch, and a table never lays out below its min-content
  (all engines). So the used width is max(min-content, min(100ch, max-content)). The preview
  had `width: calc(…)` with `max-width: max-content`, which WebKitGTK ignored (R1). The wrapper,
  `width: max-content`, follows it up to the pane and scrolls beyond.
- **Why `/ 0.95`:** `ch` on the table is the table's font, 0.95 of the document's; dividing
  makes the cap the document's 100ch. It would drift if a theme changed the table's font
  size; none does.
- **The floor:** an empty block in the header cell, 12ch of the table font, raises that
  column's min-content to 12ch. Only on columns where some cell is longer than 14 characters
  (12ch ≈ 14 characters, from the reading-width measurement): a column of short values keeps
  its own width.
- **Why text length:** measuring each column's real width needs a layout pass per table. The
  length is a stand-in; it misjudges a column of very wide or very narrow glyphs, or one whose
  cells hold an image (no text, no floor). Marked `ponytail:`.

`examples/widths.md`: a 10-column table of short phrases, "too many to fit the cap at their
narrowest", the one case the sample lacked.

**Docs:** `src-tauri/themes/README.md`, the contract paragraph: tables step out up to 100ch
(`--measure-wide`), wider only when their columns can't fit; `--measure-wide` therefore caps
tables too, and a theme lifts that with `100vw` (R4). `README.md`'s "spread wider when they
need to" still holds.

## Measured so far (preview, WebView2 154, owner's PC, pane 1085 px, ch 8.47 px)

| Sample table | Floors | Table | Result |
|---|---|---|---|
| Flag/Means, Key/Value | 0 | 17ch, 13ch | natural, at the column's left edge |
| Language (4 columns) | 1 (Notes) | 50ch | natural |
| 5 long-text columns | 5 | 100.0ch | capped, cells wrap |
| 10 short-phrase columns (new) | 7 | 133ch | at its floors; wider than the pane here, so it scrolls |
| 15 unbreakable columns | 0 | 167ch | min = max = 1415 px; scrolls, as before |

Not yet measured: WebKit and WebKitGTK; a maximised window; the cost on a large table.

## Open points

- **R1. `max-width` on a table is the risk.** CSS 2.1 leaves min/max-width on tables
  undefined. WebView2 honours `max-width: max-content` (the narrow tables above stay
  natural). If WebKit or WebKitGTK ignores it, every table there stretches to 100ch, the
  Key/Value one included. Probe P8 checks before anything ships. Fallback if it fails: move
  the cap to an extra inner wrapper div (`width: max-content; max-width: 100ch; min-width:
  min-content`), where min-width beats max-width by the spec, at the cost of one more element
  per table.
  **Result (2026-10-11, P8 on WebKitGTK 2.52.6):** it fails there. The computed value reads
  `max-content`, but table layout ignores it, so Flag, Key/Value and Language all stretched to
  100ch; the toolbar passed. The Linux session found, injected in the page, that `width:
  fit-content; max-width: calc(var(--measure-wide) / 0.95)` gives the Windows numbers exactly
  (17, 13, 49.9, 99.9, 133.1, 167ch): it never asks for `max-content` as a maximum, only a
  plain length, which WebKitGTK honours on a table. **Owner: take the fit-content swap**,
  re-probed on all three engines, the wrapper fallback kept if any fails.
- **R2. Raw HTML tables.** A `<table>` written in HTML with no `<th>` row gets its floor class
  on a `<td>`, which the `th.floor` selector misses: no floors, the cap still applies. A
  `colspan` misaligns the column count. **Owner: leave as is** (2026-10-11): Markdown tables
  always have a header row and no spans.
- **R3. Cost.** For each column the floor check copies the row list and scans down it until a
  cell is longer than 14 characters, so a column of short values reads every row: at worst
  rows × columns `textContent` reads, plus one row-list copy per column. Measure on a large
  table (P9) before calling it free.
- **R4. A theme that lifts the measure.** `--measure: 100vw` turns the prose cap off, but
  tables would still stop at `--measure-wide` (100ch); no theme sets either today. **Owner:
  document it** (2026-10-11): the themes README says `--measure-wide` also caps tables, and
  `100vw` lifts that.

## Tasks

### Task 1: the change

- [x] The CSS, the JS and the sample, as previewed.
- [x] The themes README sentence.
- [x] Commit: "Cap wide tables at the wide measure, with a floor for text columns" (subject
  to the owner).

### Task 2: verify

Each peer applied the change as a patch to a throwaway worktree at `10685b9` and built the
audit debug app; nothing of it was pushed.

- [x] **P8, all three engines:** for each sample table in `examples/widths.md`, the table's
  width in the document's ch (from a `width: 100ch` box) and whether it scrolls, at a pane
  narrower than the 10-column table's floors (about 133ch) and one wider. Expect the table
  above: narrow tables natural, not 100ch (R1); the 5-column one 100ch; the 10-column one at
  its floors (about 133ch).
  **Result:** the previewed CSS failed on WebKitGTK 2.52.6 and on WebKit (Safari 27, macOS
  26.7.1): Flag, Key/Value and Language at 100ch (R1). With the fit-content swap, every table
  passes on all three (WebView2 154.0.4258.62 too), at a ~1100 px pane and a wide one:
  Flag 17ch, Key 13, Language 50, Column one 100 (no scroll), Name 133 (scrolls only when the
  pane is narrower), A 167 (likewise); in tufte the same within 0.3ch.
- [x] **P9, WebView2:** render time of a 2,000-row, 10-column table with and without the floor
  check (`openTab`, then the content's height read), three runs each.
  **Result:** opening it took 1423-1818 ms; the floor check alone 3.8-8 ms (under 0.6%).
- [x] **Walk, WebView2 VM:** the sample maximised and at about 1100 px, in azure-devops and
  tufte: cells wrap inside the cap, short columns keep their width, a scrolling table still
  scrolls by drag and keyboard, no sideways page scroll.
  **Result:** all pass. One find, fixed in the change review (C1): "medium, new JS" in a
  squeezed column wrapped before its comma.
- [x] **Screenshots:** the five in `docs/screenshots` (1102 px). Any table in them wider than
  100ch now wraps; all five are retaken anyway for the toolbar (Task 4), so check the tables
  in the new ones.
  **Result:** retaken on the Windows VM (kitchen-sink.md, same framing), brought over by the
  owner-approved branch `walk/table-cap` (5656042). Only the toolbar changed in the four theme
  shots; kitchen-sink's tables are under the cap. `settings.png` also shows the centred
  column, which the old file predated.

## Part 2: toolbar order

**Spec:** the owner, 2026-10-11, added to this plan after its review: "I want the open folder
button to be before the history buttons and move the open file button to where the folder
toggle button was".

Read as one button named twice ("open folder" = the folder toggle, `#folder-btn`, the only
folder button in the bar); the owner confirmed this order:

```text
now:  [Back] [Fwd]  [Folder]  file name …  [Open ▾] [Update] [Theme] [Settings]
new:  [Folder]  [Back] [Fwd]  [Open ▾]  file name …  [Update] [Theme] [Settings]
```

**Current (`index.html`, `#bar-row`):** `#nav` holds Back, Forward and `#folder-btn`;
`#controls` on the right holds `#open-split` (the Open face, its ▾ arrow and `#open-menu`),
`#update-btn`, the theme button and Settings. `#nav #folder-btn { margin-left: 0.25rem }`
sets the folder button a step apart, "not the third of a set". The bar sits under the native
title bar on every platform, so nothing overlays its left edge.

**Change:**

- `index.html`: `#folder-btn` first in `#nav`; `#open-split` moved whole (face, arrow, menu)
  from `#controls` to the end of `#nav`.
- `base.css`:
  - the folder button's step moves to its right (`margin-right: 0.25rem`), and `#open-split`
    gets the same step on its left, so Back/Forward still read as a pair;
  - `#open-menu` is shared with the tree and sort menus at `right: 0`; under a button at the
    bar's left it would run off the window, so it gets `left: 0; right: auto`.
- `#open-split` is a flex container that stretches its two halves to one height, so it keeps
  its seam in `#nav` (`align-items: center`) as it did in `#controls` (`stretch`). To check
  by eye in the preview.
- No JS: handlers are found by id, and `#open-split` lookups (`closest`) move with it. Tab
  order follows the new order, which is what the bar shows.
- `README.md` line 19, "The folder icon beside Back/Forward", still holds.
- **Screenshots:** all five show the bar, so all five are retaken (with Part 1's table check).

### Task 3: the toolbar order

- [ ] A preview build on the owner's PC, as for the tables, and the owner's look.
- [ ] Commit: "Put the folder button first and Open beside Back/Forward" (subject to the
  owner).

### Task 4: verify the toolbar

- [x] **WebView2 VM:** the bar at a narrow window (the file name gives way, nothing wraps or
  overlaps); the Open menu opening under its button and inside the window; the folder toggle,
  Back and Forward working; Tab order.
  **Result:** all pass. At a 504 px viewport the bar stays one row, the file name ellipsed,
  the menu at 122-275 px; Esc closes it and focus returns to the arrow. Tab order: folder,
  Back/Forward (when enabled), Open, its arrow, theme, Settings.
- [x] **Mac and Linux VM:** one screenshot of the bar each.
  **Result:** both pass, rects identical to WebView2's (folder 12-42, Back 50-80, Forward
  84-114, Open 122-152, arrow 151-175, all 6-30 tall; the menu from 122).
- [x] **Screenshots:** all five retaken (with Task 2's table check).

## Change review

- **C1 (from the walk):** in a column squeezed to its longest word, "medium, new JS" wrapped
  as "medium" / ", new JS". Measured on WebView2: the cell's content box came out 67.5 px
  against 67.7 px for "medium," unwrapped, and `.markdown-body`'s `overflow-wrap: break-word`
  then split the word. Fixed with `overflow-wrap: normal` on `th` and `td`: in a table it
  never narrows a column (a table can't go below its longest words), so this rounding case is
  all it did. **Re-checked on the WebView2 VM:** azure-devops and tufte, 1100 px and
  maximised, the cell reads "medium," / "new JS"; the word runs 0.70 px (azure-devops) and
  0.21 px (tufte) into the cell's right padding instead of breaking, no text reaches a border
  in the Name table, and P8 and the sideways check are unchanged.
- **Pass 1:** the CSS comment named only WebKitGTK as ignoring `max-width: max-content` on a
  table; the Mac's WebKit does too. Fixed, here and in `base.css`.
- **Pass 2:** clean, with C1's re-check in.
- **Triage (owner, 2026-10-11):** the character-count floor rule (CJK undercounted) and HTML
  tables without floors (R2), each **accepted with a reopen trigger** in `open-items.md`; the
  sub-pixel overhang left after C1, **accepted, no record**.

## Packaging

The table change and the toolbar order as two feature commits, plus this plan as a `docs:`
commit. The version, if released, is the owner's to name.
