# Ctrl+Q to Quit, and a Resizable Sidebar Plan

> **Status (2026-10-15):** built and walked on all three platforms; change review and triage
> done. Awaiting packaging.

**Spec:** the owner, 2026-10-15: "I want to implement a quit shortcut like cmd+q for windows and
linux. use ctrl+q like git-ui. also, I want the folder sidebar to be resizable".

## Part 1: Ctrl+Q quits on Windows and Linux

### Current behaviour (main at 21221e5)

- macOS only: the menu's own Quit item (`macos_menu`, `main.rs:1605`, accelerator
  `CmdOrCtrl+Q`). Its handler (`main.rs:2001`) spawns `session::gather(&app, "quit-requested")`,
  which asks every booted window for its last report and waits up to `REPORT_TIMEOUT`, then
  `app.exit(0)`.
- Every window already answers `quit-requested` (`app.js:5527`), on every platform; only macOS
  ever sends it.
- Windows and Linux have no menu and no quit key. `Ctrl+Q` does nothing today (`onKeydown` has
  no `q`).

### The change

- `main.rs`: the menu handler's body becomes a shared `fn quit(app: &AppHandle)` (spawn,
  gather, exit), not `#[cfg(target_os = "macos")]`. A new command `quit_app` calls it; the
  macOS menu handler calls it too. Registered in `generate_handler!`.
  - No capability change: `build.rs` is a bare `tauri_build::build()` with no command
    allow-list, so app commands need no permission (checked; `capabilities/default.json` lists
    only plugin and core ones).
  - A sync command runs on the main thread; `quit` only spawns, so nothing blocks there while
    the answers (themselves commands) arrive.
- `app.js`, `onKeydown`: `Ctrl+Q` invokes `quit_app`.
  - Not on macOS (`!isMac`): there the page sees the key before the menu does (README, the
    `Shift+Cmd+W` note), so both would fire. Harmless — a second gather ends in the same exit
    (`main.rs:1998`) — but the menu is the Mac's way.
  - Spelled as the reload's: `ctrl && !event.altKey && !event.shiftKey && (k === "q" ||
    event.keyCode === 81)` — `keyCode` for non-Latin layouts, no `Alt` for AltGr.
  - **Placed before the modal guard** (Q1): quits with Settings, the update dialog or a zoomed
    diagram open, as the Mac menu does.
- Quits the app: **every window**, as Cmd+Q does, not just the one in front.
- `README.md`: a `Ctrl+Q` row in the shortcut table ("Quit — every window, each sending where it
  stands first"); line 359, "**Quit** from the menu on macOS" becomes "`Ctrl+Q`, or **Quit** from
  the menu on macOS".

### Risks

- **R1. `app.exit` on Windows and Linux is unproven here.** It has only ever run on macOS. As
  windows go, `Destroyed` fires `session::window_closed` (the chain of recent closes, written
  with the window still in). Reasoned, not measured, to behave as on the Mac. The walk checks a
  two-window, multi-tab session comes back whole after Ctrl+Q with Reopening on Restore.
- **R2. A window still booting** is not waited on (`gather`'s rule); its pending file stands in.
  Same as the Mac. No change.

## Part 2: a resizable sidebar

### Current behaviour

- `#sidebar` (`base.css:469`): `width: 16rem`, sticky under the bar, full height, scrolls on its
  own, `border-right` as the edge.
- `#sidebar + main` sibling selectors (`base.css:1270-1274`) pick the empty-state hints.
- A picture at Fit refits on window resize only (`onResize`, `app.js:1932`).

### The change

- `index.html`: `<div id="sidebar-grip" role="separator" aria-orientation="vertical"
  aria-label="Resize sidebar" tabindex="0"></div>` between `#sidebar` and `main`.
  - Outside the sidebar: inside, an absolutely placed grip would scroll away with the tree.
  - The five `#sidebar … + main` selectors become `~ main` (still the sibling after it).
- `base.css`:
  - `#sidebar { width: clamp(10rem, var(--sidebar-w, 16rem), 50vw) }` — CSS keeps it sane on a
    narrowing window, JS only sets `--sidebar-w`.
  - `#sidebar-grip`: `flex: none; width: 6px; margin: 0 -5px 0 -1px` (net 0, so `main` doesn't
    move) — over the sidebar's 1px border and 5px of main's left padding, **not** over the sidebar's scrollbar, which sits at its
    right edge on Windows and Linux. Sticky like the sidebar, same height, `cursor:
    col-resize`, transparent; `--ui-accent` on hover, drag and `:focus-visible`.
    `#sidebar[hidden] + #sidebar-grip { display: none }`.
  - `z-index: 6`: above `main`'s fade band (5, the root stacking context — `main`'s
    `container-type: inline-size` makes none), below the bar (10) and the menus (20).
  - `html.resizing-sidebar, html.resizing-sidebar * { cursor: col-resize !important;
    user-select: none }`, the tab drag's pattern (`html.dragging-tab`, `base.css:1212`): the
    cursor holds once the pointer leaves the 6px grip, and nothing selects under the drag (R3).
- `app.js`:
  - `pointerdown` on the grip: `setPointerCapture`; `pointermove`: `--sidebar-w` =
    `clientX - sidebar.left` px on `#sidebar`; then `onResize()` so a picture at Fit or a zoomed
    diagram follows. `pointerup`/`lostpointercapture`: stop, save (Q2).
  - Keyboard (Q3): Left/Right on the focused grip step 16 px, Home resets to 16rem; each
    `preventDefault`ed (Home would scroll the page) and saved. Nothing in `onKeydown` takes a
    plain arrow or Home, so no clash.
  - Read back the clamped width (`sidebar.offsetWidth`) when saving, so a drag past the clamp
    doesn't store a number the CSS never shows. `* { box-sizing: border-box }` (`base.css:79`),
    so `offsetWidth` and `width` are the same box: no 1px creep per relaunch.
  - At boot, `--sidebar-w` from `settings.sidebar_width` when non-zero (`get_settings` flattens
    `Config`, so the field arrives with no change there).
  - `aria-valuenow` in px, kept current.
- **Width is remembered** (Q2): one global value in `config.json` (`sidebar_width`, px, 0 =
  default), like `folder_sort` — `set_sidebar_width` command, read from `get_settings` at boot.
  Not broadcast: another window keeps its width until launched again, the same rule as the sort.
  - `config.rs`: `pub sidebar_width: u32`, `0` in `Default`, and an old-config test (a config
    without the field loads with `0`), as `folder_sort` has.
  - `main.rs`: `set_sidebar_width(width: u32)`, load–set–save like `set_folder_sort`.
- `README.md`: the sidebar paragraph gains "drag its edge to resize it; the width is kept".

### Risks

- **R3. Text selection during a drag.** `preventDefault` on `pointerdown`, pointer capture and
  the `user-select: none` class should stop it. To check on all three engines.
- The diagram renderer's iframe (`app.js:517`) is offscreen and inert, so it can't catch the
  drag; no other frames in the page.
- **R4. Scroll anchoring.** Dragging reflows `main`, so the reading position drifts like a window
  resize does today. Not new; the walk notes how far.
- **R5. WebKitGTK `cursor: col-resize`** on a sticky element: unmeasured.

## Owner rulings (2026-10-15)

- **Q1.** Ctrl+Q with a dialog open: **quit anyway**, as Cmd+Q does.
- **Q2.** Width: **remembered globally in config**.
- **Q3.** **Keyboard resizing on the grip**, as a focusable separator.

## Tasks

### Task 1: Ctrl+Q

- [x] `quit` + `quit_app` in `main.rs`; the macOS menu calls `quit`.
- [x] `Ctrl+Q` in `onKeydown`; README rows.
- [x] Gates: `cargo fmt`, `cargo clippy`, `cargo test` (213 passed).
- [x] Commit: "Quit with Ctrl+Q on Windows and Linux".

### Task 2: the sidebar grip

- [x] HTML, CSS, JS, config field and command; README.
- [x] Gates as Task 1 (214 passed).
- [x] Commit: "Resize the folder sidebar by dragging its edge".
- Deviations from the plan: no `pointerup` handler (`lostpointercapture` is the one end of a
  drag, so nothing saves twice); grip keys ignore any modifier, so Alt+← stays Back.

### Task 3: verify

The walks ran from the temp branch `walk/quit-sidebar` (WebView2 155, WebKitGTK on Xvfb,
macOS 26.7 WKWebView).

- [x] **Windows VM walk, Ctrl+Q.** Process gone in 248 ms, exit 0; session.json held both windows,
  all 5 tabs, scrollY 600; relaunch brought both back as they were (R1). It quits with Settings
  open; Ctrl+Shift+Q and Ctrl+Alt+Q reach the page and do nothing.
- [x] **Windows VM walk, grip.** Limits 160 / 550 at innerWidth 1100; nothing selected (R3);
  config follows each drag and relaunch keeps it; arrows step 16 and stop at both limits; Home
  resets to 256 and 0; a picture at Fit refits; 50vw at innerWidth 600, no growth past the
  saved width on widening; the scrollbar stays grabbable; the empty-screen hints are unchanged.
- [x] **Linux VM:** the same, all pass. Ctrl+Q exits in 0.09–0.56 s and writes session.json
  itself (it was deleted 1.5 s before the key and came back whole), so R1 holds on Linux too.
  The cursor reads col-resize (R5, from computed style; Xvfb doesn't capture the cursor).
  WebKitGTK overlays its scrollbar, so the grip covers only the border.
- [x] **Mac:** the moved `quit()` compiles; Cmd+Q exits once in under 500 ms with 2 windows, all
  tabs and scrollY 2600 saved and restored; Control+Q does nothing. Grip checks all pass.
- [x] **Rechecks on Windows** of each walk fixup (below): the grab offset tracks 1:1; the aria
  range is 160 to max(160, innerWidth/2), updated on a window resize without focus.

## Change review

- **C1 (pass 1):** a drag or arrow past the 50vw cap left the raw `--sidebar-w`, so a window
  widened later grew the sidebar toward it. Fixed: the clamped width is written back.
- **C3 (pass 1):** `aria-valuenow` in px against ARIA's default 0–100 range. Fixed, then
  refined by W1.
- **Pass 2:** clean.
- **M1 (Mac, Windows, Linux):** grabbing the 6 px grip off its left edge jumped the edge 2–3 px
  to the pointer. **Owner: fix.** The grab offset is kept through the drag.
- **M2 (Mac, Windows):** aria values stale after a window resize. **Owner: fix.** Updated from
  `onResize`.
- **W1 (Windows, Linux):** aria range 0 to innerWidth against a real 160 to 50vw. **Owner: fix.**
  Range now the CSS clamp, read at runtime.
- **W3 (Windows recheck):** no aria values on the grip until first focus, drag or resize.
  **Owner: fix.** Set when the sidebar opens.
- **M4 / W2 (walk guide):** the macOS title-bar click to bring the app forward, and
  `checkVisibility()` for the skill's `v()` helper. **Owner: add**, in a `docs:` commit.
- **Triage (owner, 2026-10-15):** all **accepted, no record**:
  - C2: a plain click on the grip saves the current width instead of 0;
  - L1: on Xvfb, WebKitGTK keeps the grip's hover accent after a release off it, until the
    next mouse move;
  - M3: one Mac walk saved an unscrolled document at its bottom after Cmd+Q. Not reproduced on
    any platform; outside this change.
- **Seen, outside this change:** opening a picture in a tab moves the sidebar to the picture's
  folder. The sidebar follows the tab (README); not looked into further.

## Packaging

Two feature commits, the fixups squashed into the sidebar one, plus the walk-guide notes and
this plan as `docs:` commits. The temp branch `walk/quit-sidebar` is deleted once the walks
are done. The version, if released, is the owner's to name.
