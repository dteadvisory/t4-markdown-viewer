# Wider Reading Column in Wide Windows Plan

> **Status (2026-10-11):** executed on the owner's go (Task 1, `c22e795`) and verified on all
> three engines (Task 2); owner rulings Q1-Q3 recorded. Tried first as a live, uncommitted
> trial on the owner's PC (WebView2 only, injected over DevTools) and approved by eye ("looks
> good"). The trial the owner saw was a container query; the `clamp` form below switches at the
> same width in the default font.

**Goal:** in a wide window the reading column widens one step, from 75ch to 100ch, so the
margins don't swallow the page. Below the switch nothing changes.

**Builds on** `docs/plans/reading-width-centred.md` (the centred column, on main as `a8276c3`,
pushed, not released).

**Spec:** the owner, 2026-10-11, with the centred build open: "can we make a 2 step cap? when
the margins become wider 75ch make the cap wider, around 120". On learning that `ch` is the
width of "0", so 75ch holds about 90 real characters in this font: 100ch for 120 real
characters; "looks good" on the trial.

## Current behaviour (main at 38dba87)

- `.markdown-body` sets `--measure: 75ch` and centres the column with
  `padding-inline: max(var(--content-pad), calc((100% - var(--measure)) / 2))` (`base.css`,
  document metrics). `100%` is the pane's width; `ch` is the document font's.
- Wide content (tables, diagrams, block pictures) steps out of the column up to the pane
  (`100cqw`), and a narrow table sits at the column's left edge. Both follow the padding, so
  they follow any change to the column.
- No theme sets `--measure`. `src-tauri/themes/README.md` documents it: a length; `100vw` turns
  the limit off.

## Measured so far (WebView2 154, owner's PC, debug build of 38dba87)

- 75ch holds 83-96 real characters a line (mean 90) in the default document font (Libron
  at 14px, `ch` 8.48 px); 1 `ch` ≈ 1.2 characters. So 100ch ≈ 120 characters.
- The owner's screen is 1708 CSS px wide (2560 px at 150%); maximised, the pane is 1692 px.
  The literal reading, "each margin wider than 75ch", needs a pane of 225ch ≈ 1910 px, so it
  never fires there. The trial used "both margins together wider than 75ch": a pane of 150ch,
  1272 px in the default font.
- Probe P7 (below), WebView2 only, on a hidden copy of `.markdown-body` at fixed widths: the
  formula gives 75ch up to 150ch of pane and 100ch past it; `--measure: 100vw` still turns the
  cap off; a theme's `--measure: 60ch` steps to 100ch past 120ch.

## Change

One rule, in `base.css`'s document metrics:

```css
--measure: 75ch;
/* Once the margins together would pass the measure, the column widens to this. */
--measure-wide: 100ch;
/* The reading column, centred in the pane: the sides take what the measure leaves. */
padding-inline: max(
  var(--content-pad),
  calc((100% - clamp(var(--measure), (100% - 2 * var(--measure)) * 1000 + var(--measure),
                     var(--measure-wide))) / 2)
);
```

- **How it steps:** the middle term is below `--measure` while the pane is under twice the
  measure, and above `--measure-wide` once it passes by 0.025ch; `clamp` holds it at one or
  the other. In that 0.025ch ramp (about 0.2 px) the column is part-way between, which no one
  can see. At exactly twice the measure the
  column is still the measure.
- **Why not a container query:** the trial used `@container (min-width: …)`, but there `ch` is
  the "0" of the pane's own font (8 px), not the document's (8.48 px), so the switch would
  land off "both margins" by 6%, more with a theme or document font of another width. In the
  padding, `ch` and `100%` are both the document's own.
- **Themes:** `--measure-wide` is a theme variable like `--measure`. A theme's `--measure:
  100vw` still turns the cap off: the switch then needs a pane of 200vw, and `clamp`'s minimum
  wins over a smaller maximum (P7).

**Docs:**

- `README.md` "Reads like a page": "a centred column about 90 characters wide, about 120 in a
  wide window" (real characters, as measured; owner ruling R1 in the change review).
- `src-tauri/themes/README.md`, the contract: the step in `ch`, and `--measure-wide`.
- `docs/open-items.md`, the document-font note: "is 75 characters of the document font" →
  "is 75ch of the document font (100ch in a wide window)".
- Screenshots: all five are 1102 px wide. If that is the pane in CSS px, the switch (150ch)
  stays above it for any font whose "0" is wider than 7.35 px; at 150% scaling the pane is
  smaller still. Expected unchanged, not measured: checked in Task 2, retaken only if one
  crosses.

## Tasks

### Task 1: the rule and its docs

- [x] The CSS above, in place of the `--measure` and `padding-inline` lines (their comments
  kept).
- [x] The three doc edits.
- [x] Commit: "Widen the reading column a step in a wide window" (or as the owner retitles;
  see Packaging).

### Task 2: verify

Each peer applied the rule to a throwaway worktree at `38dba87` (nothing pushed) and built the
audit debug app.

- [x] **P7 on all three engines:** WebView2 (md-viewer-win-vm), WebKit (md-viewer-macos),
  WebKitGTK (md-viewer-linux-vm). A hidden `.markdown-body` at pane widths 800 px, the switch
  (150ch of that engine's document font) − 1 px, the switch, + 1 px, and 2500 px; expect 75ch,
  75ch, 75ch, 100ch, 100ch. Then `--measure: 100vw` (cap off: column = pane less padding, up
  to the viewport) and `--measure: 60ch` (60ch, stepping to 100ch past 120ch).
  **Result: every line matches** on WebView2 154.0.4258.62, WebKit 21624.5.1.11.3 (Safari 27,
  macOS 26.7.1) and WebKitGTK 2.52.6 (Ubuntu 26.04): 75.00ch at the exact switch, 100ch 1 px
  past it, the cap off under `100vw` (column = pane less padding, up to the viewport), 60ch
  stepping to 100ch. On WebView2, points ±0.05 px around the switch land mid-ramp (81ch,
  66ch), confirming the ramp is about 0.19 px.
  - The probe's copy sits outside `#content`, so it measured the base font, not the document
    font; each switch was computed from the copy's own font, so the result holds. The live
    pages, all past their switch, showed a 100ch column (847 px in Libron) on all three.
  - A probe caveat, not a defect: it took `ch` from a "0" glyph's box, which in Palatino (Tufte
    in the copy) is 0.13% wider than CSS `1ch`, so its "switch − 1 px" landed past the real
    switch and read 100ch. Re-run with `ch` from a `width: 100ch` box: matches, as above. A
    later probe should measure `ch` that way.
- [x] **Walk, one engine (WebView2 VM, screen 1920×1200):** `examples/widths.md` maximised
  (pane 1905 px) and at a 1100 px pane, in azure-devops and tufte. Maximised: about 100ch
  (azure-devops col 529-1376 px, tufte 445-1460), narrow tables at the column's left edge,
  wide tables, diagrams and the 1800 px picture across the pane, everything centred, no
  sideways scroll. At 1100 px: 75ch (azure-devops col 232-868), the narrow table lined up
  with the prose, the wide many-column table scrolling in its box, the wide diagram scaled to
  the pane, no sideways scroll. Nothing looked off in 6 screenshots read.
- [x] The screenshots: switch at 1272.7 px (azure-devops, azure-devops-dark; Libron 14px),
  1453.1 (dracula-blue; 16px), 1525.8 (tufte; 16.8px), all above 1102 px, so none changes.

## Change review

- Pass 1: the CSS clean. The docs called 75ch "about 75 characters", which real text puts at
  about 90. Fixed: the themes README and the open-items note now say `ch`; for the user-facing
  README the owner ruled **R1: "about 90 characters, about 120 in a wide window"**.
- Pass 2: this plan named the measured font as Segoe UI; it was Libron at 14px. Fixed.
- Pass 3: clean.
- Triage (owner): the probe's glyph-`ch` trap, **fixed** as a gotcha in the drive-app skill;
  the walk's stale maximise state after `unmaximize()` + `MoveWindow`, **accepted** as a
  driving artifact, no record.
- Pass 4 (the triage fix): the gotcha blamed Palatino; the readings (8.40625 = 538/64, Segoe's
  7.546875 = 483/64) point to the span's box snapping to 1/64 px. Reworded, cause marked as
  inferred.

## Owner rulings (2026-10-11)

Each the recommended option: Q1 both margins together; Q2 the theme variable; Q3 P7 on all
three engines, the walk on WebView2 only. The questions as asked:


- **Q1. Where the step switches.** The trial switched when both margins together pass the
  measure (pane > 2 × measure, 1272 px in the default font). Your words were "the margins
  become wider than 75ch", which read literally (each margin) never fires on your screen.
  Recommend: as tried.
- **Q2. A theme variable for the wide step.** `--measure-wide` lets a theme set its own (none
  does today; Tufte might want a narrower one). The alternative is a fixed 100ch. It's one
  name either way. Recommend: the variable, documented beside `--measure`.
- **Q3. Engine coverage.** The column already relies on `calc` and `max` in all three engines.
  `clamp()` is new to this codebase's CSS; it shipped in Chromium 79, Safari 13.1 and WebKitGTK
  2.28 (2020), all far older than the engines here, so a failure is unlikely (reasoned from
  release history, not measured). P7 is measured on WebView2 only. Running it on the Mac and
  the Linux VM costs one short brief each. Recommend: run P7 on all three, walk on WebView2
  only.

## Packaging (decided at the end, noted now)

The centred-column commit `a8276c3` is already pushed. Folding this into it would rewrite
pushed main (a force push). Keeping it as its own commit needs no rewrite, but as the newest
unprefixed commit its subject would title the next release, while the headline is the centred
column: retitle the release after publish.
