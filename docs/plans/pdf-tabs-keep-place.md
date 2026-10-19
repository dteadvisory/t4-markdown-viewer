# PDF tabs keep their place, and same-name tabs say which folder

Owner's go: 2026-10-19 ("please fix those things"), after testing PDF tabs (`pdf-tabs.md`).

## 1. A PDF tab keeps its page when you switch away and back

**Problem:** every page tab shares the one `#page-frame`, and `show()` blanks it on leaving page mode, so a PDF reloads at page 1 each time its tab comes back.

**Change (`src/app.js`, `src/notes.css`):**
- Each PDF tab gets its own iframe inside `#page`, kept in `pdfFrames` (tab id → iframe), created on first show.
- `showActive` shows that tab's frame and hides the rest. HTML pages still use `#page-frame` and are still unloaded when left, so a briefing's audio stops as before; moving from an HTML page to a PDF unloads the HTML page too.
- Hidden frames use `visibility: hidden` stacked under the shown one, not `display: none`, so the PDF viewer keeps its layout and scroll.
- `renderTabs` prunes frames whose tab is gone (closed, moved to another window) or now shows a different file.
- A PDF changed on disk still reloads (its asset version changes the URL).

## 2. Tabs with the same file name show the folder that tells them apart

**Problem:** two `Website Proposal.pdf` tabs (or two `README.md`) read the same.

**Change (`src/app.js`, `src/base.css`):** when two or more tabs share a label, each gets a muted hint after its name: the nearest parent folder where their paths differ ("Karen Harmsen", "Byron And Beyond Networking"). Tabs with a hint may grow to 20rem; the hint truncates first. The tooltip still shows the full path.

## Checks

- Two PDFs and a note open; scroll PDF A to page 2, switch to the note and to PDF B, back to A: still on page 2.
- Close PDF A: its frame is removed (count `#page iframe`).
- An HTML briefing with audio stops when switching to a PDF tab.
- Two same-name tabs show "Karen Harmsen" / "Byron And Beyond Networking"; a unique name shows no hint.
