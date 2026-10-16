"use strict";

/*
 * T4 Notes: editing and notes for Claude, on top of the viewer in app.js.
 *
 * Loaded after app.js and leaning on its globals (`els`, `activeTab`,
 * `currentEntry`, `refresh`, `toast`, the render helpers). app.js calls back
 * into this file at four points: `editorAfterShow` once a tab's page is in,
 * `notesAfterChrome` from `updateChrome`, `editorMayClose` before a tab
 * closes, and `editorOwns` / `editorDiskChanged` from the file watcher.
 *
 * Unsaved edits are also kept as a draft in localStorage, so closing the
 * window or switching tabs never loses them: the next Ctrl+E on that file
 * brings them back.
 */

const t4 = {
  editor: document.getElementById("editor"),
  editorText: document.getElementById("editor-text"),
  editorStatus: document.getElementById("editor-status"),
  editorSave: document.getElementById("editor-save"),
  editorDone: document.getElementById("editor-done"),
  editorCopy: document.getElementById("editor-copy"),
  newNoteBtn: document.getElementById("new-note-btn"),
  editBtn: document.getElementById("edit-btn"),
  notesBtn: document.getElementById("notes-btn"),
  notes: document.getElementById("notes"),
  notesClose: document.getElementById("notes-close"),
  notesFor: document.getElementById("notes-for"),
  notesGeneral: document.getElementById("notes-general"),
  notesList: document.getElementById("notes-list"),
  notesCopy: document.getElementById("notes-copy"),
  notesClear: document.getElementById("notes-clear"),
  notePop: document.getElementById("note-pop"),
  choice: document.getElementById("choice-dialog"),
  choiceTitle: document.getElementById("choice-title"),
  choiceText: document.getElementById("choice-text"),
  choiceActions: document.getElementById("choice-actions"),
};

/* ---------------- storage ---------------- */

const STORE = "t4notes:";

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(STORE + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    if (value == null) localStorage.removeItem(STORE + key);
    else localStorage.setItem(STORE + key, JSON.stringify(value));
  } catch (err) {
    console.error(err);
  }
}

/* ---------------- choice dialog ---------------- */

/**
 * Ask a question with a few answers. Resolves to the chosen button's value,
 * or "cancel" when the dialog is dismissed with Escape.
 * `buttons`: [{ value, label, primary? }], shown left to right.
 */
function askChoice(title, text, buttons) {
  t4.choiceTitle.textContent = title;
  t4.choiceText.textContent = text;
  t4.choiceActions.replaceChildren(
    ...buttons.map((b) => {
      const btn = document.createElement("button");
      btn.value = b.value;
      btn.textContent = b.label;
      if (!b.primary) btn.className = "minor";
      return btn;
    }),
  );
  t4.choice.returnValue = "";
  return new Promise((resolve) => {
    t4.choice.addEventListener("close", () => resolve(t4.choice.returnValue || "cancel"), { once: true });
    t4.choice.showModal();
    t4.choiceActions.querySelector("button:not(.minor)")?.focus();
  });
}

/* ---------------- editor ---------------- */

/** The document being edited, or `path: null` while reading. */
const editor = {
  path: null,
  /** Of the bytes last read or written, so a save can tell if someone else wrote since. */
  stamp: "",
  bom: false,
  crlf: false,
  /** The text as it stands on disk; the editor is dirty while it differs. */
  saved: "",
  /** Set when the file changed on disk under unsaved edits. */
  diskChanged: false,
  previewTimer: 0,
  draftTimer: 0,
  previewToken: 0,
};

function draftKey(path) {
  return `draft:${normPath(path)}`;
}

function editorOwns(path) {
  return editor.path !== null && samePath(path, editor.path);
}

function editorDirty() {
  return editor.path !== null && t4.editorText.value !== editor.saved;
}

/** Whether the page on screen is a Markdown document that could be edited. */
function canEdit() {
  const path = currentEntry(activeTab())?.path;
  return !!path && !isImage(path) && !JSON_DOC.test(path) && !els.content.hidden;
}

function showEditorStatus() {
  if (editor.path === null) return;
  const dirty = editorDirty();
  t4.editorStatus.textContent = editor.diskChanged
    ? "Changed on disk since you started editing"
    : dirty
      ? "Unsaved changes"
      : "Saved";
  t4.editorStatus.classList.toggle("dirty", dirty || editor.diskChanged);
  t4.editorSave.disabled = !dirty && !editor.diskChanged;
  els.docName.classList.toggle("dirty", dirty);
}

async function openEditor({ caretAtEnd = false } = {}) {
  if (editor.path !== null || !canEdit()) return;
  const path = currentEntry(activeTab()).path;
  const src = await invoke("read_source", { path });
  const draft = readStore(draftKey(path), null);
  Object.assign(editor, {
    path,
    stamp: src.stamp,
    bom: src.bom,
    crlf: src.crlf,
    saved: src.text,
    diskChanged: false,
  });
  t4.editorText.value = draft && draft.text !== src.text ? draft.text : src.text;
  if (draft && draft.text !== src.text) toast("Restored your unsaved edits to this file.");
  t4.editor.hidden = false;
  document.documentElement.classList.add("editing");
  t4.editBtn.setAttribute("aria-pressed", "true");
  showEditorStatus();
  if (editorDirty()) await renderPreview();
  t4.editorText.focus();
  const at = caretAtEnd ? t4.editorText.value.length : 0;
  t4.editorText.setSelectionRange(at, at);
  t4.editorText.scrollTop = caretAtEnd ? t4.editorText.scrollHeight : 0;
}

/* ---------------- new notes ---------------- */

/** A note file is one that lives in a folder called `Notes`. */
function isNoteFile(path) {
  return !!path && /[\\/]Notes[\\/][^\\/]+$/i.test(path);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Ctrl+Shift+N: a new, timestamped note file, saved where the reader picks
 * (the last notes folder used, at first `DTE Advisory\Sessions\Notes`), and
 * opened straight into the editor.
 */
async function newNote() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const name = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}.md`;
  const dir = readStore("noteDir", null) ?? (await invoke("default_note_dir"));
  await invoke("ensure_dir", { path: dir }).catch(console.error);
  const target = await window.__TAURI__.dialog.save({
    title: "New note for Claude",
    defaultPath: `${dir}\\${name}`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!target) return;
  writeStore("noteDir", dirName(target));
  const month = now.toLocaleString("en-AU", { month: "long" });
  const time = now.toLocaleString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "");
  const heading = `# Note, ${ordinal(now.getDate())} ${month} ${now.getFullYear()}, ${time}\n\n`;
  const path = await invoke("create_note", { path: target, text: heading });
  if (editor.path !== null && !(await editorMayClose(activeId))) return;
  await openTab(path);
  await openEditor({ caretAtEnd: true });
}

/**
 * Leave edit mode. A dirty buffer is kept as a draft when `keepDraft`, thrown
 * away otherwise. `rerender` shows the file as it is on disk again, which is
 * needed whenever the preview is what is on screen.
 */
async function closeEditor({ keepDraft, rerender }) {
  if (editor.path === null) return;
  const path = editor.path;
  if (keepDraft && editorDirty()) writeStore(draftKey(path), { text: t4.editorText.value, at: Date.now() });
  else writeStore(draftKey(path), null);
  clearTimeout(editor.previewTimer);
  clearTimeout(editor.draftTimer);
  editor.previewToken++;
  editor.path = null;
  t4.editor.hidden = true;
  document.documentElement.classList.remove("editing");
  t4.editBtn.setAttribute("aria-pressed", "false");
  els.docName.classList.remove("dirty");
  if (rerender) await refresh();
}

/** Ctrl+E and Done: unsaved edits are asked about first. */
async function toggleEditor() {
  if (editor.path === null) return openEditor();
  if (editorDirty()) {
    const answer = await askChoice("Save changes?", `${baseName(editor.path)} has unsaved changes.`, [
      { value: "cancel", label: "Cancel" },
      { value: "discard", label: "Don’t Save" },
      { value: "save", label: "Save", primary: true },
    ]);
    if (answer === "cancel") return;
    if (answer === "save" && !(await saveEditor())) return;
  }
  await closeEditor({ keepDraft: false, rerender: true });
}

/** Write the buffer to disk. Resolves true once it is saved. */
async function saveEditor(force = false) {
  if (editor.path === null) return false;
  const text = t4.editorText.value;
  try {
    editor.stamp = await invoke("save_source", {
      path: editor.path,
      text,
      stamp: editor.stamp,
      bom: editor.bom,
      crlf: editor.crlf,
      force,
    });
  } catch (err) {
    if (String(err) !== "changed-on-disk") {
      toast(err);
      return false;
    }
    const answer = await askChoice(
      "File changed on disk",
      `${baseName(editor.path)} was changed by something else since you started editing. Saving now replaces those changes with yours.`,
      [
        { value: "cancel", label: "Cancel" },
        { value: "save", label: "Save Mine Anyway", primary: true },
      ],
    );
    return answer === "save" ? saveEditor(true) : false;
  }
  editor.saved = text;
  editor.diskChanged = false;
  writeStore(draftKey(editor.path), null);
  showEditorStatus();
  return true;
}

/** Draw the buffer into the page beside it, as the viewer would draw the saved file. */
async function renderPreview() {
  if (editor.path === null) return;
  const token = ++editor.previewToken;
  const stale = () => token !== editor.previewToken || editor.path === null;
  let html;
  try {
    html = await invoke("render_text", { text: t4.editorText.value });
  } catch (err) {
    t4.editorStatus.textContent = String(err);
    return;
  }
  if (stale()) return;
  await warmDiagrams(html, stale);
  if (stale()) return;
  const tab = activeTab();
  const y = window.scrollY;
  els.content.innerHTML = html;
  resolveMedia(els.content, tab?.dir ?? "", tab?.repo);
  const alone = (el) => el.parentElement.childNodes.length === 1;
  for (const img of els.content.querySelectorAll("p > img, p > a > img"))
    if (alone(img) && (img.parentElement.tagName === "P" || alone(img.parentElement)))
      img.classList.add("block");
  wrapTables(els.content);
  renderDiagrams(els.content);
  highlight(els.content);
  addCopyButtons(els.content);
  window.scrollTo(0, y);
}

/** The line the caret is on, 1-based, as `data-sourcepos` counts them. */
function caretLine() {
  const t = t4.editorText;
  let n = 1;
  for (let i = t.selectionStart - 1; i >= 0; i--) if (t.value.charCodeAt(i) === 10) n++;
  return n;
}

/** Bring the part of the preview the caret is in into view. */
let followQueued = false;
function followCaret() {
  if (followQueued || editor.path === null) return;
  followQueued = true;
  requestAnimationFrame(() => {
    followQueued = false;
    const line = caretLine();
    let best = null;
    for (const el of els.content.querySelectorAll("[data-sourcepos]")) {
      const start = parseInt(el.dataset.sourcepos, 10);
      if (start <= line) best = el;
      else break;
    }
    if (!best) return;
    const r = best.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar-h")) || 0;
    if (r.top < top || r.bottom > window.innerHeight) best.scrollIntoView({ block: "center" });
  });
}

/** Called by app.js once a tab's page is on screen. */
async function editorAfterShow() {
  if (editor.path === null) return;
  const path = currentEntry(activeTab())?.path;
  if (path && samePath(path, editor.path) && !els.content.hidden) {
    await renderPreview();
    return;
  }
  // The tab moved on to another document: its edits wait as a draft.
  const name = baseName(editor.path);
  const dirty = editorDirty();
  await closeEditor({ keepDraft: true, rerender: false });
  if (dirty) toast(`Unsaved edits to ${name} are kept. Open it and press Ctrl+E to carry on.`);
}

/** Called by app.js when the edited file changes on disk. */
async function editorDiskChanged() {
  if (editor.path === null) return;
  let src;
  try {
    src = await invoke("read_source", { path: editor.path });
  } catch (err) {
    toast(err);
    return;
  }
  if (src.stamp === editor.stamp) return; // our own save
  if (!editorDirty()) {
    Object.assign(editor, { stamp: src.stamp, bom: src.bom, crlf: src.crlf, saved: src.text });
    const at = t4.editorText.selectionStart;
    t4.editorText.value = src.text;
    t4.editorText.setSelectionRange(at, at);
    await renderPreview();
    toast("Reloaded: the file changed on disk.");
  } else {
    editor.diskChanged = true;
  }
  showEditorStatus();
}

/** Called by app.js before a tab closes. Resolves false to keep it open. */
async function editorMayClose(id) {
  if (editor.path === null || id !== activeId) return true;
  if (editorDirty()) {
    const answer = await askChoice("Save changes?", `${baseName(editor.path)} has unsaved changes.`, [
      { value: "cancel", label: "Cancel" },
      { value: "discard", label: "Don’t Save" },
      { value: "save", label: "Save", primary: true },
    ]);
    if (answer === "cancel") return false;
    if (answer === "save" && !(await saveEditor())) return false;
  }
  await closeEditor({ keepDraft: false, rerender: false });
  return true;
}

function flushDraft() {
  if (editorDirty()) writeStore(draftKey(editor.path), { text: t4.editorText.value, at: Date.now() });
}

/* ---------------- notes ---------------- */

/** Notes on the document on screen, or scratch notes with none open. */
function notesKey() {
  const path = currentEntry(activeTab())?.path;
  return path ? `notes:${normPath(path)}` : "notes:__scratch__";
}

let notesShownFor = null;

function loadNotes() {
  const n = readStore(notesKey(), null);
  return { general: n?.general ?? "", items: Array.isArray(n?.items) ? n.items : [] };
}

function saveNotes(n) {
  writeStore(notesKey(), n.general.trim() || n.items.length ? n : null);
}

function renderNotes() {
  const tab = activeTab();
  notesShownFor = notesKey();
  t4.notesFor.textContent = tab ? `On ${tab.label}` : "Scratch notes: no document open.";
  const n = loadNotes();
  t4.notesGeneral.value = n.general;
  t4.notesList.replaceChildren(
    ...n.items.map((item, i) => {
      const li = document.createElement("li");
      li.dataset.index = i;
      const q = document.createElement("blockquote");
      q.textContent = item.quote;
      q.title = item.line ? `Line ${item.line}: click to find it` : "";
      if (item.line) q.dataset.line = item.line;
      const box = document.createElement("textarea");
      box.value = item.text ?? "";
      box.placeholder = "Your note…";
      box.setAttribute("aria-label", "Note on this passage");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "note-delete";
      del.title = "Delete this note";
      del.setAttribute("aria-label", "Delete this note");
      del.textContent = "×";
      li.append(q, box, del);
      return li;
    }),
  );
  for (const box of t4.notesList.querySelectorAll("textarea")) fitBox(box);
  fitBox(t4.notesGeneral);
}

/** Grow a note's box with what is typed in it. */
function fitBox(box) {
  box.style.height = "auto";
  box.style.height = `${Math.max(box.scrollHeight + 2, 56)}px`;
}

function showNotes(open) {
  t4.notes.hidden = !open;
  document.documentElement.classList.toggle("notes-open", open);
  t4.notesBtn.setAttribute("aria-pressed", String(open));
  writeStore("panel", open ? 1 : null);
  if (open) renderNotes();
}

/** Called from `updateChrome`: whatever the active tab now is. */
function notesAfterChrome() {
  t4.editBtn.disabled = editor.path === null && !canEdit();
  if (!t4.notes.hidden && notesShownFor !== notesKey()) renderNotes();
  if (editor.path !== null) showEditorStatus();
}

/** The passage to note on: the selection in the page, or in the editor. */
function selectedPassage() {
  if (document.activeElement === t4.editorText && editor.path !== null) {
    const t = t4.editorText;
    const text = t.value.slice(t.selectionStart, t.selectionEnd);
    return text.trim() ? { text, line: caretLine() } : null;
  }
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!els.content.contains(range.commonAncestorContainer)) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  const start = range.startContainer;
  const owner = (start.nodeType === 1 ? start : start.parentElement)?.closest("[data-sourcepos]");
  return { text, line: owner ? parseInt(owner.dataset.sourcepos, 10) : null };
}

function addNote() {
  const passage = selectedPassage();
  if (!t4.notes.hidden || passage) showNotes(true);
  if (!passage) {
    t4.notesGeneral.focus();
    return;
  }
  let quote = passage.text.replace(/\s+/g, " ").trim();
  if (quote.length > 600) quote = `${quote.slice(0, 600)}…`;
  const n = loadNotes();
  n.items.push({ quote, line: passage.line, text: "" });
  saveNotes(n);
  renderNotes();
  getSelection()?.removeAllRanges();
  hidePop();
  const boxes = t4.notesList.querySelectorAll("textarea");
  const last = boxes[boxes.length - 1];
  last?.focus();
  last?.scrollIntoView({ block: "nearest" });
}

/**
 * All the notes on the document on screen, as one block to paste to Claude.
 * On a note file the note itself comes first, with where it is saved, so
 * Claude can read, move or file it.
 */
async function notesText() {
  const tab = activeTab();
  const n = loadNotes();
  const items = n.items.filter((i) => i.quote || i.text?.trim());
  const out = [];
  if (tab && isNoteFile(tab.path)) {
    let body;
    if (editor.path !== null && samePath(editor.path, tab.path)) body = t4.editorText.value;
    else body = (await invoke("read_source", { path: tab.path })).text;
    out.push(`My note, saved at: ${tab.path}`, "", body.trim(), "");
    if (!items.length && !n.general.trim()) return out.join("\n").trim();
    out.push("---", "");
  } else if (!items.length && !n.general.trim()) {
    return "";
  }
  if (tab) out.push(`My notes on ${tab.label}`, tab.path, "");
  else out.push("My notes", "");
  items.forEach((item, i) => {
    out.push(`${i + 1}. ${item.line ? `Line ${item.line}` : "Passage"}:`);
    out.push(`> ${item.quote}`);
    out.push("");
    if (item.text?.trim()) out.push(item.text.trim(), "");
  });
  if (n.general.trim()) {
    if (items.length) out.push("General notes:", "");
    out.push(n.general.trim(), "");
  }
  return out.join("\n").trim();
}

async function copyNotes() {
  // A note being written is saved first, so the path handed over holds it.
  const tab = activeTab();
  if (tab && isNoteFile(tab.path) && editorDirty() && samePath(editor.path, tab.path)) {
    if (!(await saveEditor())) return;
  }
  const text = await notesText();
  if (!text) {
    toast("No notes to copy yet.");
    return;
  }
  // Still inside the click or keypress that asked: the clipboard requires it.
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    toast(`Couldn’t copy: ${err}`);
    return;
  }
  if (tab && isNoteFile(tab.path)) toast("Copied your note and where it’s saved. Paste it to Claude.");
  else {
    const count = loadNotes().items.length;
    toast(`Copied ${count ? `${count} note${count === 1 ? "" : "s"}` : "your notes"}. Paste them to Claude.`);
  }
}

async function clearNotes() {
  const tab = activeTab();
  const answer = await askChoice("Clear notes?", `Delete every note on ${tab ? tab.label : "the scratch page"}?`, [
    { value: "cancel", label: "Cancel" },
    { value: "clear", label: "Clear", primary: true },
  ]);
  if (answer !== "clear") return;
  writeStore(notesKey(), null);
  renderNotes();
}

/* ---------------- the Add Note button beside a selection ---------------- */

function hidePop() {
  t4.notePop.hidden = true;
}

function placePop() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !selectedPassage()) return hidePop();
  const rects = sel.getRangeAt(0).getClientRects();
  const r = rects[rects.length - 1];
  if (!r) return hidePop();
  t4.notePop.hidden = false;
  const w = t4.notePop.offsetWidth;
  t4.notePop.style.left = `${Math.min(Math.max(8, r.right - w / 2), window.innerWidth - w - 8)}px`;
  t4.notePop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 40)}px`;
}

/* ---------------- wiring ---------------- */

function onShortcut(e) {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl || e.altKey) return;
  const k = e.key?.toLowerCase();
  let handled = true;
  if (k === "e" && !e.shiftKey) {
    if (editor.path !== null || canEdit()) toggleEditor().catch(toast);
  } else if (k === "s" && !e.shiftKey) {
    if (editor.path !== null) saveEditor().catch(toast);
  } else if (k === "m" && e.shiftKey) {
    showNotes(t4.notes.hidden);
    if (!t4.notes.hidden) t4.notesGeneral.focus();
  } else if (k === "m") {
    addNote();
  } else if (k === "c" && e.shiftKey) {
    copyNotes().catch(toast);
  } else if (k === "n" && e.shiftKey) {
    newNote().catch(toast);
  } else {
    handled = false;
  }
  if (handled) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function notesMain() {
  document.addEventListener("keydown", onShortcut, true);

  t4.editBtn.addEventListener("click", () => toggleEditor().catch(toast));
  t4.editorDone.addEventListener("click", () => toggleEditor().catch(toast));
  t4.editorSave.addEventListener("click", () => saveEditor().catch(toast));
  t4.editorText.addEventListener("input", () => {
    showEditorStatus();
    clearTimeout(editor.previewTimer);
    editor.previewTimer = setTimeout(() => renderPreview().catch(console.error), 200);
    clearTimeout(editor.draftTimer);
    editor.draftTimer = setTimeout(flushDraft, 1000);
    followCaret();
  });
  for (const ev of ["click", "keyup"]) t4.editorText.addEventListener(ev, followCaret);
  // Tab indents rather than leaving the box.
  t4.editorText.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.shiftKey ? "" : "  ");
  });
  window.addEventListener("pagehide", flushDraft);
  document.addEventListener("visibilitychange", flushDraft);
  appWindow.onCloseRequested(flushDraft).catch(console.error);

  t4.notesBtn.addEventListener("click", () => showNotes(t4.notes.hidden));
  t4.notesClose.addEventListener("click", () => showNotes(false));
  t4.notesCopy.addEventListener("click", () => copyNotes().catch(toast));
  t4.editorCopy.addEventListener("click", () => copyNotes().catch(toast));
  t4.newNoteBtn.addEventListener("click", () => newNote().catch(toast));
  t4.notesClear.addEventListener("click", () => clearNotes().catch(toast));
  t4.notesGeneral.addEventListener("input", () => {
    const n = loadNotes();
    n.general = t4.notesGeneral.value;
    saveNotes(n);
    fitBox(t4.notesGeneral);
  });
  t4.notesList.addEventListener("input", (e) => {
    const li = e.target.closest("li");
    if (!li || e.target.tagName !== "TEXTAREA") return;
    const n = loadNotes();
    const item = n.items[li.dataset.index];
    if (!item) return;
    item.text = e.target.value;
    saveNotes(n);
    fitBox(e.target);
  });
  t4.notesList.addEventListener("click", (e) => {
    const del = e.target.closest(".note-delete");
    if (del) {
      const n = loadNotes();
      n.items.splice(del.closest("li").dataset.index, 1);
      saveNotes(n);
      renderNotes();
      return;
    }
    const q = e.target.closest("blockquote[data-line]");
    if (q) {
      const line = parseInt(q.dataset.line, 10);
      const el = [...els.content.querySelectorAll("[data-sourcepos]")].find(
        (x) => parseInt(x.dataset.sourcepos, 10) === line,
      );
      el?.scrollIntoView({ block: "center" });
    }
  });

  // Mouse down so the press itself does not clear the selection first.
  t4.notePop.addEventListener("mousedown", (e) => e.preventDefault());
  t4.notePop.addEventListener("click", addNote);
  els.content.addEventListener("mouseup", () => setTimeout(placePop));
  document.addEventListener("mousedown", (e) => e.target !== t4.notePop && hidePop());
  window.addEventListener("scroll", hidePop, { passive: true });
  document.addEventListener("keyup", (e) => e.shiftKey && setTimeout(placePop));

  if (readStore("panel", null)) showNotes(true);
  notesAfterChrome();
}

notesMain();
