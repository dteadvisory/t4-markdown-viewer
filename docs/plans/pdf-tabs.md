# PDFs in a tab

**Goal:** open `.pdf` files in T4 Notes, so it can be the Windows default for PDFs and Adobe Acrobat can be uninstalled.

**Approach:** reuse the HTML page tab (commit e7d702f). A PDF loads over the asset protocol into the same `#page-frame` iframe, and WebView2 draws it with the Edge PDF viewer built into it: zoom, page jump, contents, rotate, two-page view, find, print and save a copy. Tested 2026-10-19: no highlight or draw tools show in WebView2's viewer. No PDF library is bundled.

## Changes

1. **`src-tauri/src/main.rs`:** add `PDF_EXTS = ["pdf"]` and `is_pdf()`; accept PDFs wherever `is_page()` is accepted today (`file_from_args`, `find_files`, `list_dir`, the macOS `Opened` event).
2. **`src/app.js`:** `PDF_LINK = /\.pdf$/i`; `showActive` sends a PDF down the page branch; the file picker gets a "PDF" filter; a link to a PDF opens a new tab; a changed PDF on disk bumps its asset version so the tab reloads (same as pages).
3. **`src-tauri/tauri.conf.json`:** a third file association, `T4Notes.Pdf`, ext `pdf`, role Viewer, mime `application/pdf`. Check `frame-src` in the CSP already covers `http://asset.localhost` (it does since e7d702f).
4. **Windows default:** after installing, set T4 Notes as the `.pdf` default (Windows asks the user to confirm a default once; the installer cannot force it).

## Checks before calling it done

- The Edge PDF viewer renders inside the iframe from `http://asset.localhost` (not yet verified; the first thing to test, because if WebView2 refuses, the fallback is bundling Mozilla's PDF.js, a larger change that gets its own plan).
- The asset protocol serves `Content-Type: application/pdf`.
- A 50-page PDF and a proposal PDF from DTE Advisory open, scroll, search and print.
- Highlight, then "Save as": the annotated copy writes to disk.
- Double-click a PDF in Explorer with T4 Notes as default: it opens as a tab in the running window.
- Rebuilding a PDF on disk reloads its tab.
- `msPdfOOUI` stays in the disabled-features list (it hides Edge's pop-out UI, not the viewer); confirm the viewer still shows with it disabled.

## Out of scope

Editing PDF text, merging or splitting files, and certificate signatures. These are Acrobat Pro features the Edge viewer lacks.
