/* ==========================================================================
   Elevate — Task rows, swipe actions and shared list rendering
   Used by inbox, my tasks, today, upcoming, project lists, search and boards.
   ========================================================================== */
import { $, $$, escapeHtml, todayISO, diffDays, isPast, formatTime, formatDuration, isMobile } from "./utils.js";
import { icon, PRIORITY_META } from "./icons.js";
import { emptyState, toast, menu, confirmDialog } from "./ui.js";
import {
  toggleTask, getTask, getProject, getProjects, getTags, getColumn, updateTask, deleteTask,
  archiveTask, duplicateTask, snoozeTask, applyDateShortcut, setMyDay, moveTask, getColumns
} from "./store.js";
import { editTask } from "./taskform.js";

export const priorityFlag = (priority) => `
  <span class="priority-flag priority-flag--${priority}" data-tip="${escapeHtml(PRIORITY_META[priority].label)}">
    ${icon(PRIORITY_META[priority].icon, 14)}
  </span>`;

export function dueChip(task) {
  if (!task.dueDate) return `<span class="due-chip">${icon("calendar", 11)} No date</span>`;
  const delta = diffDays(task.dueDate, todayISO());
  const cls = task.status === "done" ? ""
    : delta < 0 ? " due-chip--overdue"
      : delta === 0 ? " due-chip--today"
        : delta === 1 ? " due-chip--soon" : "";
  const label = delta < 0 ? `${Math.abs(delta)}d overdue`
    : delta === 0 ? "Today"
      : delta === 1 ? "Tomorrow"
        : new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `<span class="due-chip${cls}">${icon("calendar", 11)} ${escapeHtml(label)}${task.dueTime ? ` · ${escapeHtml(formatTime(task.dueTime, { compact: true }))}` : ""}</span>`;
}

export const tagChipsRow = (task, limit = 3) => {
  const tags = getTags();
  const items = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
  if (!items.length) return "";
  return items.slice(0, limit).map((tag) => `
    <span class="chip chip--sm"><span class="tag-dot" style="background:${tag.color}"></span>${escapeHtml(tag.name)}</span>`).join("")
    + (items.length > limit ? `<span class="chip chip--sm">+${items.length - limit}</span>` : "");
};

const subtaskProgress = (task) => {
  if (!task.subtasks.length) return "";
  const done = task.subtasks.filter((sub) => sub.done).length;
  return `
    <div class="row gap-2 mt-2" style="align-items:center">
      <div class="progress progress--xs" style="max-width:120px;flex:1">
        <div class="progress__bar" style="width:${Math.round((done / task.subtasks.length) * 100)}%"></div>
      </div>
      <span class="fs-xs text-3 tnum">${done}/${task.subtasks.length}</span>
    </div>`;
};

const taskRowMeta = (task) => {
  const column = getColumn(task.columnId);
  const bits = [
    task.estimatedMinutes ? `<span class="row gap-1">${icon("timer", 11)} ${escapeHtml(formatDuration(task.estimatedMinutes, { short: true }))}</span>` : "",
    task.recurrence ? `<span class="row gap-1">${icon("repeat", 11)}</span>` : "",
    task.attachments.length ? `<span class="row gap-1">${icon("paperclip", 11)} ${task.attachments.length}</span>` : "",
    task.comments.length ? `<span class="row gap-1">${icon("message", 11)} ${task.comments.length}</span>` : "",
    task.dependsOn && task.dependsOn.length ? `<span class="row gap-1">${icon("link", 11)} ${task.dependsOn.length}</span>` : "",
    column && column.id !== "col_todo" ? `<span class="row gap-1">${icon("kanban", 11)} ${escapeHtml(column.name)}</span>` : ""
  ].filter(Boolean);
  return bits.length ? `<span class="sep"></span>${bits.join('<span class="sep"></span>')}` : "";
};

/** Renders a single task row. */
export function taskRow(task, opts = {}) {
  const { showProject = true, draggable = false, swipe = true, selected = false, dense = false } = opts;
  const isDone = task.status === "done";
  const project = task.projectId ? getProject(task.projectId) : null;
  const overdue = !isDone && task.dueDate && isPast(task.dueDate);

  const row = `
    <div class="row-item${isDone ? " is-done" : ""}${selected ? " is-selected" : ""}" data-task="${task.id}"
      ${draggable ? 'draggable="true"' : ""} ${dense ? 'style="padding:8px 10px"' : ""}>
      <button class="check${isDone ? " is-done" : ""}" type="button" data-act="toggle" aria-label="${isDone ? "Reopen task" : "Complete task"}">
        ${icon("check", 13)}
      </button>
      <div class="row-item__body">
        <div class="row-item__title">
          ${priorityFlag(task.priority)}
          <span class="grow truncate">${escapeHtml(task.title)}</span>
          ${task.myDay && !isDone ? `<span class="badge badge--accent" data-tip="In My Day">${icon("sun", 10)}</span>` : ""}
          ${task.recurrence ? `<span data-tip="${escapeHtml(`${task.recurrence.freq} repeat`)}">${icon("repeat", 12)}</span>` : ""}
        </div>
        <div class="row-item__meta">
          ${dueChip(task)}
          ${overdue ? '<span class="badge badge--danger">Overdue</span>' : ""}
          ${showProject && project ? `<span class="row gap-1" style="align-items:center"><span class="tag-dot" style="background:${project.color}"></span>${escapeHtml(project.name)}</span>` : ""}
          ${tagChipsRow(task, 2)}
          ${taskRowMeta(task)}
        </div>
        ${task.description && !dense ? `<div class="fs-xs text-3 clamp-2 mt-2">${escapeHtml(task.description)}</div>` : ""}
        ${subtaskProgress(task)}
      </div>
      <div class="row-item__actions">
        ${!isDone ? `<button class="icon-btn" type="button" data-act="focus" data-tip="Start focus">${icon("play", 14)}</button>` : ""}
        <button class="icon-btn" type="button" data-act="myday" data-tip="${task.myDay ? "Remove from My Day" : "Add to My Day"}">${icon("sun", 14)}</button>
        <button class="icon-btn" type="button" data-act="menu" data-tip="More">${icon("more-h", 15)}</button>
      </div>
    </div>`;

  if (!swipe || !isMobile()) return row;
  return `
    <div class="swipeable" data-swipe="${task.id}">
      <div class="swipeable__bg">
        <span>${icon("check", 14)} Complete</span>
        <span>Snooze ${icon("clock", 14)}</span>
      </div>
      <div class="swipeable__content">${row}</div>
    </div>`;
}


/** Renders grouped lists with section headers. */

export function taskGroups(groups, opts = {}) {
  if (!groups.length || !groups.some((group) => group.tasks.length)) {
    return opts.empty || emptyState({ icon: "check-circle", title: "Nothing here", text: "You are all clear." });
  }
  return groups.filter((group) => group.tasks.length).map((group) => `
    <section class="task-group" data-group="${escapeHtml(group.key)}">
      ${group.label ? `<div class="task-group__head">
        <span class="task-group__title">${escapeHtml(group.label)}
          <span class="task-group__count">${group.tasks.length}</span>
        </span>
        <span class="line"></span>
      </div>` : ""}
      <div class="list stagger">${group.tasks.map((task) => taskRow(task, opts)).join("")}</div>
    </section>`).join("");
}

/* --------------------------------------------------------------- Actions */
export function taskMenu(anchor, taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const isDone = task.status === "done";
  const columns = getColumns();
  const projects = getProjectOptions();

  menu(anchor, [
    { type: "label", label: "Schedule" },
    { label: "Today", icon: "sun", onClick: () => { applyDateShortcut(taskId, "today"); toast({ title: "Scheduled for today", type: "success" }); } },
    { label: "Tomorrow", icon: "calendar", onClick: () => { applyDateShortcut(taskId, "tomorrow"); toast({ title: "Scheduled for tomorrow", type: "success" }); } },
    { label: "This weekend", icon: "calendar", onClick: () => { applyDateShortcut(taskId, "weekend"); toast({ title: "Moved to the weekend", type: "success" }); } },
    { label: "Next week", icon: "calendar-clock", onClick: () => { applyDateShortcut(taskId, "nextweek"); toast({ title: "Moved to next week", type: "success" }); } },
    { label: "Snooze for a day", icon: "clock", onClick: () => { snoozeTask(taskId, 1); toast({ title: "Snoozed for a day", type: "info" }); } },
    { label: "Clear date", icon: "x", onClick: () => { applyDateShortcut(taskId, "none"); toast({ title: "Date cleared", type: "info" }); } },
    { type: "sep" },
    { type: "label", label: "Organise" },
    { label: "Edit details", icon: "pencil", shortcut: "E", onClick: () => editTask(taskId) },
    { label: task.myDay ? "Remove from My Day" : "Add to My Day", icon: "sun", onClick: () => setMyDay(taskId) },
    { label: isDone ? "Reopen task" : "Mark complete", icon: "check", onClick: () => toggleTask(taskId) },
    { label: "Duplicate", icon: "copy", onClick: () => { duplicateTask(taskId); toast({ title: "Task duplicated", type: "success" }); } },
    ...(projects.length ? [{ type: "sep" }, { type: "label", label: "Move to project" }, ...projects.slice(0, 6).map((project) => ({
      label: project.name,
      icon: "folder",
      active: project.id === task.projectId,
      onClick: () => {
        moveTask(taskId, { projectId: project.id, sectionId: null });
        toast({ title: `Moved to ${project.name}`, type: "success" });
      }
    }))] : []),
    ...(columns.length ? [{ type: "sep" }, { type: "label", label: "Move to column" }, ...columns.map((column) => ({
      label: column.name,
      icon: "kanban",
      active: column.id === task.columnId,
      onClick: () => {
        moveTask(taskId, { columnId: column.id });
        toast({ title: `Moved to ${column.name}`, type: "success" });
      }
    }))] : []),
    { type: "sep" },
    { label: "Archive", icon: "archive", onClick: () => { archiveTask(taskId); toast({ title: "Task archived", type: "info" }); } },
    {
      label: "Delete",
      icon: "trash",
      danger: true,
      onClick: async () => {
        const ok = await confirmDialog({
          title: "Delete this task?",
          message: `“${task.title}” will be removed permanently.`,
          confirmLabel: "Delete",
          danger: true
        });
        if (ok) { deleteTask(taskId); toast({ title: "Task deleted", type: "info" }); }
      }
    }
  ]);
}

const getProjectOptions = () => getProjects().map((project) => ({ id: project.id, name: project.name }));

/** Wires the shared interactions for any container holding task rows. */
export function bindTaskList(root, { onFocusTask = null, onChanged = null } = {}) {
  root.addEventListener("click", (event) => {
    const row = event.target.closest("[data-task]");
    if (!row) return;
    const taskId = row.dataset.task;
    const action = event.target.closest("[data-act]");
    const task = getTask(taskId);
    if (!task) return;

    if (!action) { editTask(taskId, { onSaved: onChanged }); return; }

    switch (action.dataset.act) {
      case "toggle": {
        const completing = task.status !== "done";
        if (completing) {
          action.classList.add("is-done", "check-burst");
          setTimeout(() => action.classList.remove("check-burst"), 560);
          toast({ title: "Nice work", desc: task.title, type: "success", duration: 2000 });
        }
        toggleTask(taskId);
        if (onChanged) onChanged();
        break;
      }
      case "myday":
        setMyDay(taskId);
        toast({ title: task.myDay ? "Removed from My Day" : "Added to My Day", type: "info", duration: 1700 });
        if (onChanged) onChanged();
        break;
      case "focus":
        if (typeof onFocusTask === "function") onFocusTask(taskId);
        break;
      case "menu":
        event.stopPropagation();
        taskMenu(action, taskId);
        break;
      default:
        break;
    }
  });

  /* ---------- Mobile swipe: right completes, left snoozes ---------- */
  let startX = 0;
  let startY = 0;
  let active = null;
  let deltaX = 0;

  root.addEventListener("touchstart", (event) => {
    const wrap = event.target.closest("[data-swipe]");
    if (!wrap) return;
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    active = { wrap, content: $(".swipeable__content", wrap) };
    deltaX = 0;
  }, { passive: true });

  root.addEventListener("touchmove", (event) => {
    if (!active) return;
    const touch = event.touches[0];
    deltaX = touch.clientX - startX;
    if (Math.abs(touch.clientY - startY) > Math.abs(deltaX)) return;
    active.content.style.transform = `translateX(${Math.max(-120, Math.min(120, deltaX))}px)`;
  }, { passive: true });

  root.addEventListener("touchend", () => {
    if (!active) return;
    const { wrap, content } = active;
    const taskId = wrap.dataset.swipe;
    content.style.transform = "";
    active = null;
    if (Math.abs(deltaX) < 84) return;
    if (deltaX > 0) {
      toggleTask(taskId);
      toast({ title: "Task completed", type: "success", duration: 1700 });
    } else {
      snoozeTask(taskId, 1);
      toast({ title: "Snoozed for a day", type: "info", duration: 1700 });
    }
    if (onChanged) onChanged();
  });

  /* ---------- Drag & drop reordering within a list ---------- */
  root.addEventListener("dragstart", (event) => {
    const row = event.target.closest("[data-task]");
    if (!row) return;
    event.dataTransfer.setData("text/plain", row.dataset.task);
    event.dataTransfer.effectAllowed = "move";
    row.classList.add("is-dragging");
  });
  root.addEventListener("dragend", (event) => {
    const row = event.target.closest("[data-task]");
    if (row) row.classList.remove("is-dragging");
    $$(".is-drop-target", root).forEach((node) => node.classList.remove("is-drop-target"));
  });
  root.addEventListener("dragover", (event) => {
    const row = event.target.closest("[data-task]");
    if (!row) return;
    event.preventDefault();
    $$(".is-drop-target", root).forEach((node) => node.classList.remove("is-drop-target"));
    row.classList.add("is-drop-target");
  });
  root.addEventListener("drop", (event) => {
    const row = event.target.closest("[data-task]");
    if (!row) return;
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === row.dataset.task) return;
    const order = $$("[data-task]", root).map((node) => node.dataset.task);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(row.dataset.task);
    if (from === -1 || to === -1) return;
    const target = getTask(row.dataset.task);
    updateTask(draggedId, { order: target ? target.order : to });
    if (onChanged) onChanged();
  });
}


/* --ROWS-APPEND-- */
