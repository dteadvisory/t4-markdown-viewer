# Centred Reading Column Plan

> **Filed (2026-10-15):** executed; shipped in 1.8.1 as a8276c3. The status below is as it
> stood before the go.
>
> **Status (2026-10-11):** draft for the owner's review. Built first as an uncommitted preview
> on the owner's PC (WebView2 only) and approved by eye ("previews look good"). Owner rulings
> recorded: E1-E11, Q1-Q2 (each the recommended option), M1 (clip). Probes P4-P6 run on all
> three engines (walk branch `walk/reading-width-centred`, bb736ed). Not to be executed until
> the owner's go.

**Goal:** the reading column sits in the middle of the window, like a web page, instead of at
its left edge. Content wider than the column (tables, diagrams, pictures) steps out of it,
centred on the same middle line, up to the window's width. Code stays in the column: commands
wrap with a hanging indent, other code scrolls. The diagram view gets a close button you can
find, and loses the document's scrollbar beside it.

**Builds on** `docs/archive/plans/reading-width.md` (the left-aligned version, committed on main as
`9ab7abb`, not pushed or released). Kept from it: line-height 1.7, `--measure: 75ch`, each
diagram drawn at its natural px width (C2'), the JSON view at full width (C5). Replaced: the
per-element cap with its `:has()` exceptions, `fit-content` on code blocks and diagrams, and
the `@property` registration of `--measure` (see Q1).

**Spec:** the owner, 2026-10-11, after seeing the left-aligned build: "it looks weird being
right on the left edge, I sort of want to prefer the text to be in the middle like a website
… maybe center them as well initially and generate me a sample md file"; then, on the preview:
the long command "better if capped in width too and wrap", the wide code block "capped too but
keep the scroll bar"; "is there a way to indent the long commands wrapping?" (JavaScript, and a
multi-command sample); tables "left aligned when smaller than the cap then centered when
larger"; the diagram view needs "a close button", and its side scrollbar "looks weird"; the ×
off-centre, the toolbar's ends cramped, − and + too far from the level; "yes don't break on
hyphens"; "images are good as they are"; "previews look good".

## Current behaviour (main at 541b23f, without the preview's uncommitted diff)

- **The column** is held by `max-width: var(--measure)` on each prose element, with `:has()`
  exceptions for blocks holding wide content (`base.css`, the rule after `.markdown-body`).
  Everything starts at `--content-pad` (2.5rem) from the pane's left edge.
- **Code blocks** are `fit-content`, at least the measure wide and at most the column
  (`.markdown-body pre`); the JSON view puts back `width: auto` (`.markdown-body.json pre`).
- **Diagrams** are `fit-content` the same way, centred by `text-align: center`.
- **Tables** sit in `div.table-scroll` (`wrapTables`, `app.js:389`), `max-width: 100%`.
- **Pictures** are `max-width: 100%` of their paragraph (`.markdown-body img`).
- **The diagram view** (`#diagram-dialog`, `index.html:273`) has its × as the last button of
  the zoom toolbar, bottom right, at 85% opacity; Esc also closes it. A modal dialog's box is
  the viewport less the document's scrollbar (comment at `base.css`, `#diagram-dialog`), so
  the document's scrollbar shows beside it.
- **The zoom toolbars** (`#image-tools`, `#diagram-tools`) share one style: `gap: 0.25rem`,
  `padding: 0.25rem`, the level `min-width: 3.25rem`.

## Decisions

Ruled by the owner, 2026-10-11, on the preview:

- **E1. A centred reading column.** `.markdown-body`'s side padding grows to centre a column
  `--measure` wide; below that width the padding stays `--content-pad`. Lists, quotes,
  definitions and footnotes sit inside the column with their indents, so every right edge
  meets the column's. That lifts L1-L3 of the first plan (see Records).
- **E2. Wide content steps out, centred:** tables, diagrams and pictures alone in their
  paragraph are as wide as they need, up to the pane less `--content-pad` each side, centred
  on the column's middle line.
- **E3. Narrow tables sit at the column's left edge;** a table wider than the column is
  centred (E2).
- **E4. Pictures are centred, whatever their width** ("images are good as they are").
- **E5. Code stays in the column.** Commands wrap; other code scrolls sideways in its box.
- **E6. A command is a block in a shell language:** `sh`, `bash`, `shell`, `zsh`, `fish`,
  `console`, `shellsession`, `powershell`, `ps1`, `pwsh`, `cmd`, `bat`, `batch`, any letter
  case. A block with no language, or another language, scrolls. Not chosen: by place (code in
  a list wraps), or both.
- **E7. A wrapped command line hangs 2em under its start,** by splitting each command into a
  block per line in JavaScript. Not chosen: CSS `text-indent: … hanging each-line`, which
  WebView2 is believed not to support (from memory, not measured).
- **E8. A command never breaks after a hyphen:** `--manifest-path`, `t4-markdown-viewer`
  wrap whole. Only each hyphen and its two neighbours are held together, so a long path can
  still break elsewhere when it must.
- **E9. The diagram view's close button is a drawn × in the top-right corner,** 2.25rem
  square, always fully visible; the toolbar keeps only −, level, + and Fit. Esc still closes.
- **E10. The document's scrollbar is hidden while a diagram is open,** its gutter held so the
  text behind doesn't reflow. Not chosen: hiding it and letting the text reflow.
- **E11. Toolbar spacing,** for the diagram and image toolbars alike: 0.5rem at each end;
  − and + tight around the level (its box just fits "3200%", the zoom maximum, and gives up
  the toolbar's gaps); 0.5rem more before Fit.

Ruled by the owner, 2026-10-11, in the plan review (each (a)):

- **Q1. What `--measure: none` should mean now.** The first plan let a theme switch the limit
  off with `none`, and registered `--measure` with `@property` so headings would share the
  paragraphs' edge in characters of the body font. The centred column reads `--measure` only
  on `.markdown-body` itself, so the registration no longer does anything. And the centring
  padding is `calc((100% - var(--measure)) / 2)`, which `none` makes invalid; an invalid
  padding falls back to 0, text against the pane's edges.
  - (a) **Recommended:** drop the `@property` rule; `--measure` takes lengths only. A theme
    turns the limit off with a length wider than any window (the themes README says
    `100vw`), which the `max()` turns back into `--content-pad`. A theme that sets something
    invalid gets text against the edges, which its author sees at once. No bundled theme sets
    `--measure`.
  - (b) Keep `none`. CSS can't test a variable's value, so this needs JavaScript to read the
    computed value after each theme change; more moving parts for a case no theme uses.
- **Q2. A picture inside a link,** alone in its paragraph (`[![alt](pic.png)](url)`, common
  for badges and screenshots that link out): treat it as a block, like a bare picture, so a
  wide one steps out and centres? (a) **Recommended:** yes, the same rule one level down.
  (b) No: it stays in the column, held to its width.

## Design

### The column (E1)

```css
.markdown-body {
  /* …as now (line-height 1.7, --measure: 75ch)… */
  /* The reading column, centred in the pane: the sides take what the measure leaves. */
  padding-inline: max(var(--content-pad), calc((100% - var(--measure)) / 2));
}
```

- The percentage in `padding` is of the containing block, `main`, the document's pane.
- The per-element cap and its `:has()` rule are removed, and with Q1 (a) the `@property`
  rule.

### Wide content steps out (E2-E4)

```css
main {
  /* `cqw` in the document is the pane's width, for content wider than the reading column. */
  container-type: inline-size;
}

.markdown-body .table-scroll,
.markdown-body div.mermaid-diagram,
.markdown-body img.block {
  width: max-content;
  max-width: calc(100cqw - 2 * var(--content-pad));
  margin-left: 50%;
  translate: -50%;
}
```

- `margin-left: 50%` puts the box's left edge on the column's middle line, and `translate`
  moves it back by half its own width: centred, at any width, without layout knowing.
- Tables and diagrams also get `min-width: 100%`: at least the column, so a narrow table's
  box spans the column and the table sits at its left (E3), and a narrow diagram is centred
  in it by `text-align: center`. Pictures have no minimum (E4).
- The JSON view keeps the whole pane: `.markdown-body.json { padding-inline:
  var(--content-pad) }`. Its `pre` has no width rules left to undo.
- `img.block`: `renderDocument` marks a picture that is its paragraph's only child node
  (`p > img`, and with Q2 (a) `p > a > img` where the link is the paragraph's only child and
  the picture the link's), right after `resolveMedia`.

### Code (E5-E8)

- `.markdown-body pre` loses its width rules: a block in the column, scrolling sideways.
- `highlight` (`app.js:404`) calls `splitLines(code)` on a block whose `language-…` class
  matches `SHELL_CODE`, after highlight.js has run. `splitLines`:
  - rebuilds the block as one `span.line` per source line, each keeping its `\n`, so
    `textContent` (copy, find) is unchanged;
  - splits a highlight span that crosses a line break (a heredoc, a quoted string) and
    reopens it on the next line;
  - wraps each hyphen run with its neighbours in `span.nobr` (`holdHyphens`);
  - marks the `pre` `.command`.
- CSS: `pre.command { white-space: pre-wrap }`, `.nobr { white-space: nowrap }`,
  `.line { display: block; padding-left: 2em; text-indent: -2em }`.

### The diagram view (E9-E11)

- `#diagram-close` moves out of the toolbar to the dialog's top-right corner, an SVG ×
  (the sidebar's close icon) in a flex-centred 2.25rem button. Clicks are handled on the
  dialog, not the toolbar (`onDiagramToolsClick` already acts only on `button[data-zoom]`).
- E10 as a class, not the preview's `html:has(#diagram-dialog[open])`: `openDiagram` adds
  `diagram-open` to `<html>` and `onDiagramClose` removes it, like `image-mode`. The removal
  goes after `onDiagramClose`'s `if (els.diagramDialog.open) return;` (`app.js:1391`): the
  close event comes a task after `close()`, and a diagram opened again in between must keep
  the class. `html.diagram-open { overflow: hidden; scrollbar-gutter: stable }`. A `:has()` on the root
  is re-checked on DOM changes anywhere in the page, which the JSON view makes by the
  thousand (reasoned, not measured); a class costs nothing.
- E11 as in the preview: toolbar `padding: 0.25rem 0.5rem`; level `min-width: 2.5rem;
  margin-inline: -0.25rem`; Fit `margin-left: 0.5rem`.

### The page never scrolls sideways (M1, ruled 2026-10-11)

- `.markdown-body { overflow-x: clip }`. P6 measured a pane-wide table three list levels deep
  running 2 px past a 700 px pane on all three engines, which scrolled the whole page
  sideways. With `clip`, what passes the pane's edge is cut off (the table still scrolls
  inside its own box); `clip`, unlike `hidden`, makes no scroll container, so the sticky bar
  and anchor jumps are unaffected (reasoned; the walk checks). Not chosen: accepting the
  2 px, or JavaScript to centre nested content on the column.

### Known limits (proposed at the end of the change review loop)

- **M1.** Wide content inside a list item or quote is centred on that item's box, not the
  column, so it sits off-centre by half the indents: three levels deep, a pane-wide table sat
  42 px right of centre at 1600 px (P6, Windows and Linux; the Mac 91 px left of it against 7
  right at 1512). Its overflow past the pane is clipped (above).
- **M2.** A command written without a language (a bare fence), or in a language not in E6,
  scrolls instead of wrapping.
- **M3.** On Windows, whose scrollbars take space, the diagram view leaves the 15 px held
  gutter beside it, painted in the page's background. In the default theme it is
  pixel-identical to the view (P5); a theme whose page background differs from `--page-bg`
  would show it as a strip (unmeasured; the walk checks three themes).

## Probes (before execution)

Run 2026-10-11 on the Windows VM, the Linux VM and the Mac (never the owner's PC), each in a
throwaway worktree of the owner-approved walk branch `walk/reading-width-centred` (bb736ed:
52e0001 plus the preview): WebView2 154 (1600 px), WebKitGTK 2.52.6 (1600 px, Wayland) and the
Mac's WebKit (Safari 27, 1512 px), each also at 700 px, on `examples/widths.md` and a
deep-list fixture:

- [x] **P4 — the centring CSS on each engine:** `container-type` on `main` and `100cqw`
  inside the document; `translate`; the padding's percentage; `--measure: 100vw` set on
  `.markdown-body` gives `--content-pad` padding (Q1 (a)'s off switch).
  - **All three: as designed.** The column 635 px, centred (padding 475 / 482 / 438 px each
    side); paragraphs end on its edge. Narrow tables at its left edge (inside a list, at the
    item's); wide tables, diagrams and pictures centred, the widest the pane less 80 px.
    Narrow pictures centred (E4). The off switch gave 40 px. Nothing scrolled sideways, wide
    or at 700 px (padding 40 px).
- [x] **P5 — the diagram view and commands on each engine:** the scrollbar hidden and its
  gutter held while a diagram is open (document width and scroll position before, during and
  after; whether an empty strip shows on WebKit, where scrollbars may overlay); the ×
  centred; command blocks' text unchanged (`textContent` against the source) and no `.nobr`
  split across lines; copying a wrapped command gives its lines exactly.
  - **Commands, all three:** 5 of 8 blocks are commands; every block's text equals its
    source; a selection of each command gives its text exactly; no `.nobr` split across
    lines; wrapped lines hang 2em; no flag split at a hyphen.
  - **The view, all three:** no scrollbar while open, and scroll position and document width
    unchanged after closing by × or Esc. The × exactly centred in its button. Linux and the
    Mac have overlay scrollbars, so nothing to hold; Windows keeps a 15 px gutter, the same
    colour as the view in the default theme (M3).
  - **Focus:** after a mouse open, closing leaves focus on the page, not the diagram: the
    app's existing design (a mouse press lets go of the focus it gave, `app.js:5189-5195`).
    A keyboard open returns focus to the diagram (the Mac, Enter then Esc).
- [x] **P6 — M1:** a table as wide as the pane in a list three levels deep: does the page
  scroll sideways?
  - **All three: yes, by 2 px at 700 px** (the box's right edge 2 px past the pane); none at
    1600 / 1512 px, where the table sits off-centre by the indents. Hence the clip (M1,
    ruled).

## Tasks

### Task 1: the change

**Files:** `src/base.css`, `src/app.js`, `src/index.html`, `src-tauri/themes/README.md`,
`README.md`, `examples/widths.md` and `examples/img/width-*.svg` (new).

- [x] **Step 1:** the preview's diff, with Q1 and Q2 as ruled, E10 as a class, and M1's
  clip.
- [x] **Step 2:** `themes/README.md`: the reading width is a centred column; `--measure` takes
  a length (`100vw` turns it off); wide content steps out of it.
- [x] **Step 3:** `README.md`: a feature line for the reading column ("Reads like a page:
  text in a centred column about 75 characters wide; tables, diagrams and pictures spread
  wider when they need to; commands wrap"), and the diagram line (`README.md:56-57`) gains
  the close button: "Escape or the × in the corner comes back".
- [x] **Step 4:** `node --check src/app.js`; commit as a fixup of the feature commit (8727549).

### Task 2: walks

On the three machines, wide (1600 px or the screen) and narrow (~700 px), in azure-devops-dark,
github-light and tufte, on `examples/widths.md`, `examples/kitchen-sink.md` and the README:

- [x] the column centred, every right edge on it; wide tables, diagrams and pictures centred
  and no wider than the pane; narrow tables at the column's left edge; nothing scrolls
  sideways, deep.md at 700 px included; the clip cuts nothing else (the sticky bar, an anchor
  jump, a find match far right in a wide table);
- [x] the diagram view's gutter on Windows in github-light and tufte too (M3);
- [x] commands wrap with the hanging indent and whole flags; other code scrolls; find and
  copy in a wrapped command;
- [x] the diagram view: the × closes it; Esc closes it; no scrollbar beside it; the reading
  place unchanged after closing; the toolbar's spacing;
- [x] a JSON file: full pane, as before; README x30 and the big JSON relayout and fold timed
  against 1.8.0 (52e0001), the layout users have now, rather than the unreleased left-aligned
  build.

**Results (2026-10-11, walk branch at be8ccc7 = 52e0001 plus the final code; WebView2 154 at
1600 px, WebKitGTK 2.52.6 at 1600 px, the Mac's WebKit at 1512 px; each at 700 px too):** all
pass on all three.

- **Layout:** widths.md, kitchen-sink.md and the README in azure-devops-dark, github-light and
  tufte: the column centred (635 / 726 / 762 px by theme), paragraphs ending on its edge,
  narrow tables at its left, wide content centred inside the pane, nothing sideways; at
  700 px everything in a 40 px-padded column.
- **Linked pictures** are block pictures and centred. The README's CI badge, a linked
  picture alone in its paragraph, is now a centred block under the title.
- **The clip:** deep-list table at 700 px scrolls inside its own box and the page doesn't
  scroll; its box's last 2 px are cut. The sticky bar and its fade, a footnote jump, and find
  scrolling a wide table across to its match all work.
- **Commands:** text, selection and find unchanged; find highlights inside wrapped lines.
- **The diagram view:** × and Esc close it, the scroll position holds, the scrollbar is
  hidden; a keyboard open returns focus to the diagram; a reopen right after a close keeps
  `diagram-open`. M3: no visible strip on Windows in any of the three themes (pixel samples
  uniform at the right edge); Linux and the Mac have overlay scrollbars.
- **Toolbars:** both fit; the image viewer's 1:1 shows for rasters and is hidden for SVGs, as
  its code intends (100% is fit for an SVG).
- **JSON view:** full pane, not centred.
- **Speed against 1.8.0 (52e0001)**, a full relayout: Linux README x30 ~225 → ~230 ms, big
  JSON ~1030 → ~1075 ms; the Mac 109 → 114 ms and 274 → 277 ms; Windows, warm runs, README
  x30 ~200 → ~225 ms and JSON ~685 → ~730 ms, in both run orders, with a spread inside each
  run as large as the gap. Fold and unfold unchanged.
- The change review then removed `els.diagramTools`, left unused by moving the click handler
  to the dialog.

### Task 3: records

- [x] Screenshots retaken (the first plan's C4 set), through an owner-approved walk branch as
  before: the Windows VM's 3b04266 on `walk/reading-width-centred`.
- [x] `docs/open-items.md` › Accepted limits: L1, L2 and L3 lifted, moved to
  `docs/closed-items.md` with "*Lifted 2026-10-…: the centred column holds every block, indents
  included (reading-width-centred.md).*"
- [x] M1-M3 as the owner rules them. Ruled 2026-10-11 in triage: M1 and M2 accepted with
  reopen triggers; M3 closed with no record (measured invisible in three themes; the gutter
  and the view share the body's background in every theme); the README's lone CI badge now
  centred, kept as Q2 working (no record); the Windows re-layout timing and a long command
  block's unmeasured cost accepted with reopen triggers; the Mac's image-viewer focus ring
  deferred.
- [x] `docs/archive/plans/reading-width.md`'s status: superseded in part by this plan.

## Review Focus

1. Nothing scrolls the page sideways at any width, in any theme, at any list depth (M1).
2. A narrow window (pane under the measure) looks as the left-aligned build did: padding
   `--content-pad`, everything in the column.
3. Command blocks: the text, copy and find are unchanged; highlighting survives the split.
4. The diagram view: after a keyboard open, closing by × or Esc returns focus to the
   diagram (after a mouse open, focus stays on the page, as today); the page doesn't jump; a
   diagram reopened right after a close keeps the scrollbar hidden.
5. The image viewer's toolbar, which shares E11, still fits and works.

## Execution

Main session orchestrates. Probes P4-P6 through the three machines' sessions, then Task 1 to a
`coder` subagent (Opus), committed on main as fixups. Walks, then the change review loop
(CLAUDE.md step 5) and triage. Packaging squashes the fixups into the feature commit, whose
title becomes the centred column's (the owner may retitle).
