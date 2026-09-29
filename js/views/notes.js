/* ==========================================================================
   Elevate — Notes: folders, cards grid and a distraction-free editor
   ========================================================================== */
import { escapeHtml, relativeTime, $, truncate } from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, toast, modal, drawer, confirmDialog, menu } from "../ui.js";
import {
  getNotes, getNote, createNote, updateNote, deleteNote, togglePinNote,
  getFolders, createFolder, addChecklistItem, toggleChecklistItem
} from "../store.js";

let activeFolder = "all";
let noteQuery = "";

const visibleNotes = () => {
  let list = getNotes();
  if (activeFolder === "pinned") list = list.filter((note) => note.pinned);
  else if (activeFolder !== "all") list = list.filter((note) => note.folderId === activeFolder);
  if (noteQuery) {
    const needle = noteQuery.toLowerCase();
    list = list.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(needle));
  }
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
};

const folderName = (id) => (getFolders().find((folder) => folder.id === id) || {}).name || "Unfiled";

function sidebar() {
  const folders = getFolders();
  const pinned = getNotes().filter((note) => note.pinned).length;
  const item = (key, label, iconName, count) => `
    <button class="folder-item${activeFolder === key ? " is-active" : ""}" type="button" data-folder="${key}">
      ${icon(iconName, 14)} <span class="grow truncate">${escapeHtml(label)}</span>
      <span class="fs-2xs">${count}</span>
    </button>`;
  return `
    <aside class="notes-side">
      <div class="col gap-1">
        ${item("all", "All notes", "note", getNotes().length)}
        ${item("pinned", "Pinned", "pin", pinned)}
        <div class="row-between mt-2 mb-2">
          <span class="page-head__eyebrow">Folders</span>
          <button class="icon-btn" type="button" data-act="new-folder" data-tip="New folder">${icon("plus", 14)}</button>
        </div>
        ${folders.map((folder) => item(folder.id, folder.name, folder.icon || "folder",
    getNotes().filter((note) => note.folderId === folder.id).length)).join("")}
      </div>
      <button class="btn btn--soft btn--block mt-4" type="button" data-act="new-note">${icon("plus", 14)} New note</button>
    </aside>`;
}

function noteCard(note) {
  const preview = note.body.replace(/\s+/g, " ").trim() || "Empty note";
  return `
    <article class="card note-card" data-note="${note.id}">
      <div class="row gap-2" style="align-items:center">
        <span class="note-card__title grow truncate">${escapeHtml(note.title || "Untitled")}</span>
        ${note.pinned ? `<span style="color:var(--accent)">${icon("pin", 12)}</span>` : ""}
      </div>
      <p class="note-card__body clamp-3">${escapeHtml(truncate(preview, 160))}</p>
      <div class="note-card__foot">
        <span>${escapeHtml(folderName(note.folderId))}</span>
        <span class="grow"></span>
        <span>${escapeHtml(relativeTime(note.updatedAt))}</span>
        <button class="icon-btn" type="button" data-act="note-menu" data-note="${note.id}" data-tip="More">${icon("more-h", 13)}</button>
      </div>
    </article>`;
}

export function render() {
  const notes = visibleNotes();
  return `
    <header class="page-head">
      <div class="page-head__main">
        <div class="page-head__eyebrow">Grow</div>
        <h1>Notes</h1>
        <p class="page-head__sub">Capture thinking, meeting notes and ideas — linked to your work.</p>
      </div>
      <div class="page-head__actions">
        <span class="input-icon">
          ${icon("search", 14)}
          <input class="input input--sm" type="search" placeholder="Search notes…" value="${escapeHtml(noteQuery)}" data-note-search />
        </span>
        <button class="btn btn--primary" type="button" data-act="new-note">${icon("plus", 15)} New note</button>
      </div>
    </header>

    <div class="notes-layout">
      ${sidebar()}
      <div>
        ${notes.length
      ? `<div class="notes-grid">${notes.map(noteCard).join("")}</div>`
      : emptyState({
        icon: "note", title: noteQuery ? "No notes match" : "Nothing here yet",
        text: noteQuery ? "Try a different search." : "Start a note for meeting decisions, drafts or anything worth keeping.",
        actions: `<button class="btn btn--primary btn--sm" type="button" data-act="new-note">${icon("plus", 14)} New note</button>`
      })}
      </div>
    </div>`;
}

let pendingRerender = null;

/* --------------------------------------------------------------- Editor */
function openNoteEditor(noteId) {
  const note = getNote(noteId);
  if (!note) return;
  let saveTimer = null;

  drawer({
    title: "Note",
    wide: true,
    headerExtra: `
      <button class="icon-btn" type="button" data-note-pin data-tip="${note.pinned ? "Unpin" : "Pin"}">${icon("pin", 16)}</button>
      <button class="icon-btn" type="button" data-note-delete data-tip="Delete">${icon("trash", 16)}</button>`,
    body: `
      <div class="editor" style="padding:var(--s-5)">
        <input class="editor__title" id="nb-title" value="${escapeHtml(note.title)}" placeholder="Untitled" maxlength="120" />
        <div class="row gap-3 fs-2xs text-3">
          <span>${icon("folder", 11)} ${escapeHtml(folderName(note.folderId))}</span>
          <span>${icon("clock", 11)} Edited ${escapeHtml(relativeTime(note.updatedAt))}</span>
          <span class="grow"></span>
          <span class="hint" data-saved>Saved</span>
        </div>
        <textarea class="editor__body" id="nb-body" placeholder="Start writing…">${escapeHtml(note.body)}</textarea>
        ${note.checklist && note.checklist.length ? `
          <div class="detail__section">
            <div class="detail__title-label page-head__eyebrow mb-2">Checklist</div>
            ${note.checklist.map((item) => `
              <div class="subtask-row">
                <button class="check${item.done ? " is-done" : ""}" type="button" data-check="${item.id}">${icon("check", 11)}</button>
                <span class="grow fs-sm ${item.done ? "text-3" : ""}" ${item.done ? 'style="text-decoration:line-through"' : ""}>${escapeHtml(item.title)}</span>
              </div>`).join("")}
          </div>` : ""}
      </div>`,
    footer: `
      <button class="btn btn--soft btn--sm" type="button" data-add-check>${icon("plus", 13)} Checklist item</button>
      <span class="grow"></span>
      <button class="btn btn--sm" type="button" data-overlay-close>Close</button>`,
    onMount: (node, overlay) => {
      const title = $("#nb-title", node);
      const body = $("#nb-body", node);
      const saved = $("[data-saved]", node);

      const persist = () => {
        updateNote(note.id, { title: title.value.trim() || "Untitled", body: body.value });
        if (saved) { saved.textContent = "Saved"; saved.style.color = "var(--success)"; }
        if (typeof pendingRerender === "function") pendingRerender();
      };
      const queue = () => {
        if (saved) { saved.textContent = "Saving…"; saved.style.color = ""; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 500);
      };
      title.addEventListener("input", queue);
      body.addEventListener("input", queue);

      $("[data-note-pin]", node).addEventListener("click", () => {
        togglePinNote(note.id);
        toast({ title: note.pinned ? "Unpinned" : "Pinned", type: "info", duration: 1400 });
        if (typeof pendingRerender === "function") pendingRerender();
      });

      $("[data-note-delete]", node).addEventListener("click", async () => {
        const ok = await confirmDialog({ title: "Delete note?", message: `“${note.title}” will be removed permanently.`, confirmLabel: "Delete", danger: true });
        if (ok) {
          deleteNote(note.id);
          overlay.close();
          toast({ title: "Note deleted", type: "info" });
          if (typeof pendingRerender === "function") pendingRerender();
        }
      });

      const addCheck = $("[data-add-check]", node);
      if (addCheck) {
        addCheck.addEventListener("click", () => {
          const value = window.prompt("Checklist item");
          if (value && value.trim()) {
            addChecklistItem(note.id, value.trim());
            overlay.close();
            openNoteEditor(note.id);
            if (typeof pendingRerender === "function") pendingRerender();
          }
        });
      }

      node.addEventListener("click", (event) => {
        const check = event.target.closest("[data-check]");
        if (check) {
          toggleChecklistItem(note.id, check.dataset.check);
          overlay.close();
          openNoteEditor(note.id);
        }
      });
    },
    onClose: () => { if (typeof pendingRerender === "function") pendingRerender(); }
  });
}

/* --NOTES-END-- */

/* ------------------------------------------------------------- Folder new */
function newFolderModal() {
  modal({
    title: "New folder",
    body: `<label class="field"><span class="field__label">Name</span>
      <input class="input" id="fd-name" maxlength="40" placeholder="e.g. Research" autofocus /></label>`,
    size: "sm",
    footer: `<button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="fd-save">Create folder</button>`,
    onMount: (node, overlay) => {
      const save = () => {
        const name = $("#fd-name", node).value.trim();
        if (!name) return;
        const folder = createFolder(name);
        activeFolder = folder.id;
        overlay.close();
        toast({ title: "Folder created", type: "success", duration: 1500 });
        if (typeof pendingRerender === "function") pendingRerender();
      };
      $("#fd-save", node).addEventListener("click", save);
      $("#fd-name", node).addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
    }
  });
}

/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  pendingRerender = rerender;

  root.addEventListener("input", (event) => {
    if (!event.target.matches("[data-note-search]")) return;
    noteQuery = event.target.value;
    const grid = root.querySelector(".notes-layout > div:last-child");
    if (grid) {
      const notes = visibleNotes();
      grid.innerHTML = notes.length
        ? `<div class="notes-grid">${notes.map(noteCard).join("")}</div>`
        : emptyState({ icon: "note", title: "No notes match", text: "Try a different search." });
    }
  });

  root.addEventListener("click", (event) => {
    const folderBtn = event.target.closest("[data-folder]");
    if (folderBtn) {
      activeFolder = folderBtn.dataset.folder;
      if (typeof rerender === "function") rerender();
      return;
    }

    const action = event.target.closest("[data-act]");
    if (action) {
      switch (action.dataset.act) {
        case "new-note": {
          const note = createNote({
            title: "Untitled note",
            folderId: activeFolder !== "all" && activeFolder !== "pinned" ? activeFolder : null
          });
          if (typeof rerender === "function") rerender();
          openNoteEditor(note.id);
          return;
        }
        case "new-folder":
          newFolderModal();
          return;
        case "note-menu": {
          const noteId = action.dataset.note;
          const note = getNote(noteId);
          if (!note) return;
          menu(action, [
            { label: "Open", icon: "pencil", onClick: () => openNoteEditor(noteId) },
            { label: note.pinned ? "Unpin" : "Pin", icon: "pin", onClick: () => { togglePinNote(noteId); if (typeof rerender === "function") rerender(); } },
            { type: "sep" },
            {
              label: "Delete", icon: "trash", danger: true, onClick: async () => {
                const ok = await confirmDialog({ title: "Delete note?", message: `“${note.title}” will be removed permanently.`, confirmLabel: "Delete", danger: true });
                if (ok) { deleteNote(noteId); toast({ title: "Note deleted", type: "info" }); if (typeof rerender === "function") rerender(); }
              }
            }
          ]);
          return;
        }
        default:
          break;
      }
    }

    const card = event.target.closest("[data-note]");
    if (card && !event.target.closest("[data-act]")) openNoteEditor(card.dataset.note);
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "notes",
  title: "Notes",
  icon: "note",
  group: "Grow",
  order: 2,
  nav: true,
  render,
  mount
}];

