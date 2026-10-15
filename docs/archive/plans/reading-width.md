# Reading Width and Line Spacing Plan

> **Filed (2026-10-15):** what this plan kept shipped in 1.8.1, in a8276c3 with the centred column.
>
> **Status (2026-10-11):** executed, then superseded in part by
> `reading-width-centred.md`: the left-aligned per-element cap gave way to a centred column.
> Kept from here: line-height 1.7, `--measure: 75ch`, diagrams at their natural width (C2'),
> the JSON view at full width (C5). Owner rulings recorded: A, B, C1-C5, C2'.

**Goal:** long text is easier to read. Prose (paragraphs, headings, list items) wraps at about
75 characters, while tables, code blocks, diagrams and images can still use the whole window
width. Lines sit a little further apart: line-height goes from 1.6 to 1.7.

**Spec:** the owner, 2026-10-11: "long text looks too cramped, will line spacing help with
readability?", then "is it possible to limit the width of just the text? but tables,
diagrams, images, etc take as wide as they need?", and a yes to "left-aligned + line-height
1.7".

## Current behaviour (read 2026-10-11, line numbers as of 52e0001)

- **Width.** `.markdown-body` (`base.css:1381-1389`) has padding `--content-pad` (2.5rem,
  `base.css:56`) and no max width, so a line of text runs the full width of the document pane.
  No theme sets a width on the document.
- **Line spacing.** `base.css:1388` sets `line-height: 1.6` on `.markdown-body`. Headings use
  1.25 (`:1438`) and code blocks 1.5 (`:1563`). Two themes set their own: Sakura 1.7
  (`sakura.css:48`) and Tufte 1.75 (`tufte.css:47`). The other eleven inherit 1.6.
- **What sits in the document:**
  - Images render inside a paragraph (`<p><img></p>`), held to the column by
    `img { max-width: 100% }` (`:1540-1543`).
  - Tables are wrapped in `div.table-scroll` by the frontend (`app.js:391-393`), which scrolls
    sideways (`:1650-1653`).
  - Code blocks are `pre`, full width, scrolling sideways (`:1558-1564`). Every bundled theme
    gives them a background, so the box is visible.
  - Diagrams are `div.mermaid-diagram` (`app.js:1102-1103`), centred in the full width
    (`:1567-1572`).
  - A JSON document is one `<pre><code>` (`json.rs:379`), with later chunks spliced in.
  - Raw `<div>` is stripped (`render.rs:791-792`), so documents can't bring their own
    wrappers.
  - Blockquotes have a left border only, with no background in any bundled theme.
- **`:has()`** is already used (`base.css:1703`, task lists), so the three webviews support it.
- No `@property` or `fit-content` is used anywhere yet.

## Decisions

Ruled by the owner, 2026-10-11 (C1-C4 each the recommended option):

- **A. Left-aligned.** Text and wide content share the left edge, and wide content runs further
  right. Centring would need a grid on the document, which stops vertical margins from
  overlapping and changes spacing everywhere.
- **B. Line-height 1.7** for the document's body text. Sakura's 1.7 and Tufte's 1.75 stay.
- **C1. A code block is as wide as it needs:** at least the text width, so short blocks line up
  with the paragraphs; longer lines widen it up to the full width, and past that it scrolls as
  now (`width: fit-content`). Not chosen: full width as now (a two-line snippet draws a box
  across the window), or text width with scrolling (long lines scroll even with room to show
  them). Cost: the browser measures each block's longest line. That is cheap for normal blocks
  but **unmeasured** on the 9.75 MB JSON document (one huge `pre`); Task 2 measures it, with a
  fallback.
- **C2. A diagram narrower than the text is centred under the text;** a wider one starts at the
  left edge and grows right, like the other wide content. Not chosen: centring in the full
  width as now, or left-aligning every diagram. P1 showed that CSS alone squeezes wide
  diagrams on the Mac and Windows, so **re-ruled 2026-10-11 (C2'):** after drawing, `app.js`
  gives each diagram its natural width in px, capped at the column (see Design), and then
  centres it as above. Not chosen then: left-align all diagrams (CSS only), or no diagram
  change. Probe P3 checks the fix on all three engines before execution.
- **C3. The width is 75 characters** of the document font (`75ch`), as one variable,
  `--measure`, which a theme can override. Typography guidance puts comfortable reading at
  45-90 characters per line; 75 is its middle, not measured here. The walks look at it in
  Libron and in a theme's own font, and the owner can retune it.
- **C5. The JSON view keeps the whole column** (ruled 2026-10-11, after Task 2): C1's
  `fit-content` on its one huge `pre` cost ~40% more layout on Linux and ~60% on the Mac
  (measured; Windows showed none), and its short lines made it a 635 px box. `renderDocument`
  marks `#content` with `json` from the file's extension, and `.markdown-body.json pre` puts
  back `width: auto; min-width: 0`, which the walks measured restoring the old speed. Not
  chosen: keeping C1 for JSON.
- **C4. README screenshots are retaken:** the opening one and the theme gallery, on the Windows
  VM in the walk, as the font change did.

## Design

In `base.css`, in "document metrics" and the elements' own rules, plus a few lines in
`app.js` for diagrams (C2'). No markup or Rust change, unless Task 2's measurement calls for
the JSON fallback.

```css
/*
 * Prose wraps at a readable width; tables, code, diagrams and images keep the
 * whole column. Registered as a length so `ch` is resolved once, in the body
 * font where it is set: headings inherit the same edge instead of 75 of their
 * own larger characters. A theme may set its own --measure.
 */
@property --measure {
  syntax: "<length> | none";
  inherits: true;
  initial-value: none;
}

.markdown-body {
  /* …existing… */
  line-height: 1.7;
  --measure: 75ch;
}

/* A block holding wide content isn't held, or the content would be held with it. */
.markdown-body :is(p, h1, h2, h3, h4, h5, h6, li, dt, dd, hr, .footnotes):not(:has(img, table, pre, .mermaid-diagram)) {
  max-width: var(--measure);
}
```

- **Code blocks (C1):** `pre` gains `box-sizing: border-box; width: fit-content;
  min-width: min(var(--measure), 100%); max-width: 100%`. Border-box, so the 1em padding
  stays inside the text edge.
- **Diagrams (C2'):** `div.mermaid-diagram` gains
  `width: fit-content; min-width: min(var(--measure), 100%); max-width: 100%`, so its
  `text-align: center` centres a narrow diagram under the text. On its own that squeezes a wide
  diagram to the text width (P1, measured), because mermaid draws the SVG with
  `width="100%"`, which a box sized by its content can't measure. So each drawing gets its
  natural width when it is prepared and cached, in `warmSources` just before
  `done = { svg: root.outerHTML }` (`app.js:985`). That covers both places a drawing enters the
  page, a first render (`renderDiagrams`, `app.js:1110`) and a redraw in a new look
  (`redrawDiagrams`, `app.js:1183`), since both copy `done.svg`:

  ```js
  // Its own width, not mermaid's "100%": the page sizes a diagram's box to the
  // drawing (base.css, the reading width), and a percentage there is circular.
  // Still held to the column by max-width.
  const natural = parseFloat(root.style.maxWidth);
  if (natural) {
    root.setAttribute("width", natural);
    root.style.maxWidth = "100%";
  }
  ```

  - Only drawings with a px `max-width` are touched (mermaid's `useMaxWidth`, its default; all
    three engines' SVGs had it, with no `height` and a `viewBox`, P3).
  - It runs after `stylesStayInside` (`app.js:956`), which reads only `<style>` rules, so the
    check is unaffected.
  - The zoom view (`openDiagram`, `app.js:1240-1265`) reads the page copy's drawn size, then
    removes `width` and resets `max-width` on its own copy, so it is unaffected (reasoned; the
    walk opens one).
- **`none` is allowed** so a theme can switch the limit off with `--measure: none`. With a
  plain `<length>` syntax, `none` would be invalid and fall back to the initial value, and a 0
  there would squash every paragraph. `min(none, 100%)` is invalid, so the `min-width` rules
  drop out too. Themes load after `base.css` (`index.html:7-9`), so a theme's value wins.
- **If `@property` isn't supported**, `75ch` is resolved in each element's own font, so
  headings get a wider limit. Text still wraps. All three current engines support it (P2).

### Known limits (proposed for acceptance at the end of the change review loop)

- **L1.** A paragraph holding any image, an inline badge or icon included, isn't held, so its
  text runs the full width. Badge rows are common at the top of READMEs; a long prose paragraph
  with an inline icon is rare (reasoned, not counted).
- **L2.** A list item or definition holding a code block, table, diagram or image isn't held,
  so the item's own text runs the full width. Common in step-by-step lists with commands.
- **L3.** Text in lists and blockquotes ends a little further right than paragraphs: their
  indent (2em, or 1em + border) is added on top of the width.
- **L4.** Descendant `:has()` on every text block may slow style recalculation on a huge
  Markdown file. Unmeasured; Task 2 measures it.

## Probes (before execution)

- [x] **P1 — a diagram's box under `fit-content`** (C2). Mermaid draws each in-document SVG
  with `width="100%"` and an inline `max-width` of its natural width (`app.js:1261-1263`
  mentions both). A percentage width inside a box that sizes itself to its content is a
  circular case, and browsers may count the SVG as 0 wide, or as some default width, instead of
  its natural width. If they do, a wide diagram would be held to the text width, which goes
  against the spec. Reasoned, not measured. On each engine, in the running app, with a narrow
  and a wide flowchart and the C2 rules added in DevTools or by script: the diagram box's
  width against the SVG's `max-width`. If any engine gets it wrong, C2 comes back to the owner
  with that result.
  - **Mac (WKWebView, 1512 px window, 2026-10-11): wrong.** The narrow diagram was right (box
    635 px, the 75ch width, with the 115 px drawing centred). The wide one (natural 2248 px,
    column 1432 px) was held to 635 px with unreadable labels.
  - **Windows (WebView2 154, 1600 px window, 2026-10-11): the same.** Box 635 px for both;
    the wide one (natural 2246 px, column 1520 px) shrunk to 635 px.
  - **Linux (WebKitGTK 2.52.6, Wayland, 1600 px window, 2026-10-11): the same.** Box 635 px
    for both; the wide one (natural 2239 px, column 1520 px) shrunk to 635 px.
  - Back to the owner: re-ruled as C2'.
- [x] **P2 — `@property` and `fit-content` on each engine:** `typeof CSS.registerProperty ===
  "function"` and `CSS.supports("width", "fit-content")`. The heading edge depends on the
  first, C1 and C2 on the second. **All three (2026-10-11): both true,** `:has` too, and
  `--measure` resolved to the same ~635.25 px on the body and an `h2`.
- [x] **P3 — the C2' fix** on each engine: with the P1 rules injected and each SVG given its
  natural width as in the Design, the wide diagram's box and drawing fill the column, the
  narrow one stays centred in a 75ch box, both keep their aspect ratio (height over width as
  before the change), and in a column narrower than the diagram (`.markdown-body` set to
  600 px wide) the drawing shrinks to fit, its aspect ratio kept.
  - **Linux (WebKitGTK 2.52.6, 1600 px window, 2026-10-11): works.** Mermaid's SVGs carry
    `width="100%"`, no `height`, a `viewBox` and a px `max-width`. With the fix: the narrow
    diagram's box is 635 px with the drawing centred; the wide one's box and drawing fill the
    1520 px column, labels readable. Both keep their aspect ratio (1.3747 and 0.0277, as
    before). In a 520 px column both boxes are 520 px and the wide drawing shrinks to fit.
    Nothing scrolls sideways.
  - **Windows (WebView2 154, 1600 px window, 2026-10-11): works,** with the same numbers: the
    narrow box 635 px with the drawing centred; the wide box and drawing fill the 1520 px
    column, labels readable; ratios kept (1.3691, 0.0285); in a 520 px column both fit.
    Nothing scrolls sideways.
  - **Mac (WKWebView, 1512 px window, 2026-10-11): works,** the same: narrow box 635 px with
    the drawing centred; wide box and drawing fill the 1432 px column, labels readable; ratios
    kept (1.4576, 0.0297); in a 520 px column both fit. Nothing scrolls sideways.

## Tasks

### Task 1: the CSS and the diagrams' width

**Files:** `src/base.css`, `src/app.js` (C2'), `src-tauri/themes/README.md`.

- [x] **Step 1:** the rules and the `warmSources` lines above; `node --check src/app.js`.
- [x] **Step 2:** `themes/README.md`, where it says `base.css` owns structure (`:53-55`):
  add the reading width, and that a theme can set `--measure` on `.markdown-body`.
- [x] **Step 3: commit:** "Wrap prose at a readable width, and space its lines further apart".

### Task 2: measure and walk

On the Windows VM, the Linux VM and the Mac (never the owner's PC), with the drive-app skill:

- [x] **Look**, in a wide window (1920 px) and a narrow one (~700 px), in azure-devops-dark
  (the default), github-light and tufte, with Libron and with the theme's font. Fixtures:
  `docs/fixtures/all-types.md` and the README. Check:
  - paragraphs, headings and list text end at one edge; headings don't run wider than
    paragraphs (the `@property` check);
  - tables, long code lines and wide diagrams use the full width; short code blocks line up
    with the text; a narrow diagram is centred under the text (C2);
  - an image wider than the text keeps the full width;
  - in a narrow window (pane under 75 characters) the cap never applies: everything fits the
    pane as before, and nothing scrolls sideways;
  - task lists, footnotes and nested lists look right.
- [x] **Measure (L4, C1):** before and after the change, the time to the first paint of the
  README repeated 30 times (1 MB, as in `archive/plans/find-in-document.md`), and of the
  first chunk of the 9.75 MB JSON plus one fold on it. If the JSON gets clearly slower, the
  JSON document's `pre` keeps today's width (a class on `#content` for JSON, set where
  `app.js` renders it), and the plan comes back for review.

**Results (2026-10-11; WebView2 154 at 1600 px, WebKitGTK 2.52.6 at 1600 px, the Mac's
WebKit (Safari 27) at 1512 px; each at ~700 px too):**

- **Look: as designed on all three.**
  - p, h1 and h2 end at one edge.
  - Lists, the blockquote and dd end further right by their indent (L3). Footnotes end with p:
    the cap is on `.footnotes`, its indent inside.
  - Short code blocks end with p; long ones reach the column and scroll inside.
  - The table, the image (natural 1102 px) and the wide diagram fill the column; the narrow
    diagram is centred under the text.
  - Nothing scrolls sideways at any width or in any theme.
  - The edge moves with the font, as designed: in Libron, 635 px (default), 726 (github-light)
    and 762 (tufte); in the theme's own font, 566 on Windows (Segoe UI), 584 on Linux and 650
    on the Mac.
  - In github-light the headings' bottom rules stop at the edge too.
- **Still works, all three:** the zoom view (identical zoom steps before and after), find, the
  footnote jump, the copy-section button.
- **Speed, README x30 relayout:** unchanged (Windows ~200-410 ms, Linux ~195-236, the Mac
  104-115).
- **Speed, the big JSON's first chunk:** slower on WebKit from C1's rule on its `pre` (Linux
  ~1.05 → 1.45 s per relayout and unfold, the Mac 274 → 440 ms); none on Windows. Isolated by
  overriding that rule; `:has()` measured no cost. Hence C5.
- **C5 checked (Linux and the Mac, 2026-10-11):** the JSON view is the full column again
  (1520 / 1432 px) at the old speed (Linux relayout ~950-1250 ms, unfold ~975-1010; the Mac
  279-283 ms, unfold 287-293). A Markdown tab opened after it, and switching between the two,
  drops and restores the `json` class each time; the Markdown keeps C1.
- **Pre-existing, not from this change (Mac, the old build too):** find doesn't paint its
  highlight on a match in a list item that holds a nested list ("A long item: lorem…"); the
  count and stepping are right.

### Task 3: records

- [x] Screenshots per C4: azure-devops, azure-devops-dark, dracula-blue and tufte retaken on
  the Windows VM (kitchen-sink.md, same framing), brought over by the owner-approved branch
  `walk/reading-width` (7221f53). Tufte's framing kept (owner's call), though it shows no code.
- [x] Limits L1-L4 as the owner rules them: `docs/open-items.md` or `docs/closed-items.md`.
  Ruled 2026-10-11: L1, L2 and L3 accepted with reopen triggers (open-items); L4 closed with
  no record (measured no cost); the headings' shorter underline kept (closed-items); a wide
  diagram unreadable in a narrow window, and the Mac's unpainted find match in a list item,
  both from before this change, deferred (open-items).
- [x] `docs/open-items.md` › "A size for the document font": a note that the reading width is
  in characters of the document font, so a size change keeps the line length.

## Review Focus

1. Nothing wide is held: tables, code blocks, diagrams, images, the JSON view, a list item
   holding any of them.
2. Nothing scrolls sideways that didn't before.
3. Headings and paragraphs share one right edge on all three engines.
4. A short code block's right edge lines up with the text's; a narrow diagram is centred
   under the text.
5. Huge documents don't get slower (L4, C1).
6. Find highlights, copy-section buttons and anchor jumps still work: they don't depend on
   width (reasoned), but the walk clicks them once.

## Execution

Main session orchestrates. Task 1 goes to a `coder` subagent (Opus) and is committed on main.
The walks run on the three platforms; the Linux VM and Mac through their sessions. Then the
change review loop (CLAUDE.md step 5). Packaging: one feature commit (the owner may retitle),
plus `docs:` records.
