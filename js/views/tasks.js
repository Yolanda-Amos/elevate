/* ==========================================================================
   Elevate — Tasks: inbox, My Day, today, upcoming, all tasks, projects
   ========================================================================== */
import { escapeHtml, $, formatDate } from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, toast, menu, confirmDialog, modal } from "../ui.js";
import { taskGroups, bindTaskList, priorityFlag, dueChip } from "../taskrows.js";
import { openQuickAdd } from "../taskform.js";
import { navigate } from "../router.js";
import { openFocusStage } from "./focus.js";
import {
  inboxTasks, myDayTasks, todayTasks, upcomingTasks, overdueTasks, unscheduledTasks,
  myTasksView, groupTasks, getUi, updateUi, updateTaskFilters, getAllProjects,
  getProject, createProject, updateProject, deleteProject, archiveProject,
  toggleProjectFavorite, tasksByProject, getColumns, tasksByColumn, moveTask,
  openTaskCount, getTags
} from "../store.js";

/* ------------------------------------------------------------- View config */
const LIST_VIEWS = {
  inbox: {
    eyebrow: "Capture", title: "Inbox", sub: "Everything captured but not yet organised.",
    group: "date",
    list: () => [...inboxTasks(), ...unscheduledTasks()],
    empty: { icon: "inbox", title: "Inbox zero", text: "Capture something the moment it lands." }
  },
  myday: {
    eyebrow: "Plan", title: "My Day", sub: "The short list you chose for today.",
    group: "flat",
    list: () => myDayTasks(),
    empty: { icon: "sun", title: "My Day is empty", text: "Add your top three — everything else can wait." }
  },
  today: {
    eyebrow: "Plan", title: "Today", sub: "Everything due today, plus what has slipped.",
    group: "flat",
    list: () => [...overdueTasks(), ...todayTasks({ includeDone: true })],
    empty: { icon: "check-circle", title: "Nothing due today", text: "Enjoy the space or plan ahead." }
  },
  upcoming: {
    eyebrow: "Plan", title: "Upcoming", sub: "The next two weeks at a glance.",
    group: "date",
    list: () => upcomingTasks(14),
    empty: { icon: "calendar", title: "Nothing scheduled", text: "Your week ahead is wide open." }
  },
  tasks: {
    eyebrow: "Organise", title: "All tasks", sub: "Filter, group and sort every task in the workspace.",
    group: null,
    list: () => myTasksView(),
    empty: { icon: "list", title: "No tasks match", text: "Loosen a filter or add something new." },
    toolbar: true
  }
};

const GROUP_LABELS = [
  { value: "date", label: "Due date" }, { value: "priority", label: "Priority" },
  { value: "project", label: "Project" }, { value: "status", label: "Status" },
  { value: "flat", label: "None" }
];
const SORT_LABELS = [
  { value: "due", label: "Due date" }, { value: "priority", label: "Priority" },
  { value: "created", label: "Date created" }, { value: "title", label: "Title A–Z" },
  { value: "manual", label: "Manual order" }
];
const STATUS_FILTERS = [
  { value: "open", label: "Open" }, { value: "done", label: "Completed" },
  { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" },
  { value: "nodate", label: "No date" }, { value: "all", label: "All" }
];

/* -------------------------------------------------------------- Fragments */
const pageHead = ({ eyebrow, title, sub, actions = "" }) => `
  <header class="page-head">
    <div class="page-head__main">
      <div class="page-head__eyebrow">${escapeHtml(eyebrow)}</div>
      <h1>${escapeHtml(title)}</h1>
      ${sub ? `<p class="page-head__sub">${escapeHtml(sub)}</p>` : ""}
    </div>
    <div class="page-head__actions">${actions}</div>
  </header>`;

const selectField = (act, options, value) => `
  <select class="select select--sm" data-select="${act}" aria-label="${escapeHtml(act)}">
    ${options.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
  </select>`;

function filtersBar() {
  const filters = getUi().taskFilters;
  const tags = getTags();
  const projects = getAllProjects();
  return `
    <div class="filters-bar">
      <span class="input-icon" style="min-width:190px">
        ${icon("search", 14)}
        <input class="input input--sm" type="search" placeholder="Filter tasks…" value="${escapeHtml(filters.search)}" data-filter="search" />
      </span>
      ${selectField("status", STATUS_FILTERS, filters.status)}
      ${selectField("priority", [
        { value: "all", label: "Any priority" }, { value: "urgent", label: "Urgent" },
        { value: "high", label: "High" }, { value: "medium", label: "Medium" },
        { value: "low", label: "Low" }, { value: "none", label: "None" }
  ], filters.priority)}
      ${selectField("projectId", [{ value: "all", label: "All projects" }, { value: "none", label: "No project" },
        ...projects.map((project) => ({ value: project.id, label: project.name }))], filters.projectId)}
      ${selectField("tagId", [{ value: "all", label: "Any tag" },
        ...tags.map((tag) => ({ value: tag.id, label: tag.name }))], filters.tagId)}
      <span class="toolbar__spacer"></span>
      ${selectField("group", GROUP_LABELS, getUi().taskGroup)}
      ${selectField("sort", SORT_LABELS, getUi().taskSort)}
      <div class="segmented">
        <button class="segmented__item${getUi().taskView === "list" ? " is-active" : ""}" type="button" data-act="view" data-view="list">${icon("list", 14)} List</button>
        <button class="segmented__item${getUi().taskView === "board" ? " is-active" : ""}" type="button" data-act="view" data-view="board">${icon("kanban", 14)} Board</button>
      </div>
    </div>`;
}

function board(projectId = null) {
  const columns = getColumns();
  if (!columns.length) return emptyState({ icon: "kanban", title: "No columns", text: "Add columns to organise a board." });
  const tags = getTags();
  return `<div class="kanban">${columns.map((column) => {
    const tasks = tasksByColumn(column.id, projectId);
    return `
      <div class="kanban__col" data-column="${column.id}">
        <div class="kanban__col-head">
          <span class="kanban__col-title">${escapeHtml(column.name)}</span>
          <span class="kanban__col-count">${tasks.length}</span>
          <span class="kanban__col-actions">
            <button class="icon-btn" type="button" data-act="add-to-column" data-column="${column.id}" data-tip="Add task">${icon("plus", 14)}</button>
          </span>
        </div>
        <div class="kanban__col-body" data-droppable="${column.id}">
          ${tasks.length ? tasks.map((task) => `
            <div class="kcard" data-task="${task.id}" draggable="true">
              <div class="row gap-2" style="align-items:center">
                <button class="check${task.status === "done" ? " is-done" : ""}" type="button" data-act="toggle" aria-label="Complete">${icon("check", 12)}</button>
                <span class="kcard__title grow truncate">${escapeHtml(task.title)}</span>
                ${priorityFlag(task.priority)}
              </div>
              <div class="kcard__meta">${dueChip(task)}</div>
              ${task.tagIds.length ? `<div class="kcard__tags">${task.tagIds.slice(0, 2).map((id) => {
    const tag = tags.find((item) => item.id === id);
    return tag ? `<span class="chip chip--sm"><span class="tag-dot" style="background:${tag.color}"></span>${escapeHtml(tag.name)}</span>` : "";
  }).join("")}</div>` : ""}
            </div>`).join("")
      : `<div class="fs-2xs text-3" style="padding:10px 4px">Empty</div>`}
        </div>
      </div>`;
  }).join("")}</div>`;
}

function listBody(viewKey) {
  const config = LIST_VIEWS[viewKey];
  const ui = getUi();
  const list = config.list();
  const mode = config.group || (viewKey === "tasks" ? ui.taskGroup : "date");
  if (viewKey === "tasks" && ui.taskView === "board") return board();
  return taskGroups(groupTasks(list, mode), {
    empty: emptyState({ ...config.empty, actions: `<button class="btn btn--primary btn--sm" type="button" data-act="quick-add">${icon("plus", 14)} Add a task</button>` })
  });
}

/* -------------------------------------------------------------- Projects */
function projectsGrid() {
  const projects = getAllProjects();
  const actions = `<button class="btn btn--primary" type="button" data-act="new-project">${icon("plus", 15)} New project</button>`;
  if (!projects.length) {
    return `${pageHead({ eyebrow: "Organise", title: "Projects", sub: "Group related work into its own space.", actions })}
      ${emptyState({ icon: "folder", title: "No projects yet", text: "Create your first project to group tasks, notes and goals.", actions: `<button class="btn btn--primary btn--sm" type="button" data-act="new-project">${icon("plus", 14)} New project</button>` })}`;
  }
  return `${pageHead({ eyebrow: "Organise", title: "Projects", sub: `${projects.length} active ${projects.length === 1 ? "project" : "projects"} · ${openTaskCount()} open tasks`, actions })}
    <div class="project-grid">${projects.map((project) => {
      const tasks = tasksByProject(project.id);
      const done = tasks.filter((task) => task.status === "done").length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      return `
        <article class="card project-card card--interactive" data-project="${project.id}">
          <div class="project-card__top">
            <span class="project-card__icon" style="background:${project.color}1a;color:${project.color}">${icon(project.icon || "folder", 17)}</span>
            <div class="grow">
              <div class="project-card__name">${escapeHtml(project.name)}</div>
              <div class="fs-2xs text-3">${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${pct}% done${project.favorite ? ` · ${icon("star", 10)}` : ""}</div>
            </div>
            <button class="icon-btn" type="button" data-act="project-menu" data-project="${project.id}" data-tip="More">${icon("more-h", 15)}</button>
          </div>
          <p class="project-card__desc clamp-2">${escapeHtml(project.description || "No description yet.")}</p>
          <div class="progress progress--xs"><div class="progress__bar" style="width:${pct}%;background:${project.color}"></div></div>
          <div class="project-card__foot">
            <span>${icon("check-circle", 12)} ${done}/${tasks.length}</span>
            <span class="grow"></span>
            <button class="btn btn--ghost btn--sm" type="button" data-act="open-project" data-project="${project.id}">Open ${icon("external", 12)}</button>
          </div>
        </article>`;
    }).join("")}</div>`;
}

function projectView(projectId, params = []) {
  const project = getProject(projectId);
  if (!project) {
    return `${pageHead({ eyebrow: "Organise", title: "Project not found", sub: "It may have been deleted." })}
      ${emptyState({ icon: "folder", title: "Missing project", text: "This project no longer exists.", actions: `<button class="btn btn--sm" type="button" data-act="go-projects">Back to projects</button>` })}`;
  }
  const mode = params[1] === "kanban" ? "kanban" : "list";
  const tasks = tasksByProject(project.id);
  const done = tasks.filter((task) => task.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const body = mode === "kanban"
    ? board(project.id)
    : taskGroups(groupTasks(tasks, "date"), { empty: emptyState({ icon: "check-circle", title: "No tasks in this project", text: "Add the first task and get moving.", actions: `<button class="btn btn--primary btn--sm" type="button" data-act="quick-add">${icon("plus", 14)} Add task</button>` }) });

  return `
    <section class="project-hero">
      <span class="project-hero__accent" style="background:${project.color}"></span>
      <div class="project-hero__row">
        <span class="project-hero__icon" style="background:${project.color}1a;color:${project.color}">${icon(project.icon || "folder", 20)}</span>
        <div class="grow">
          <div class="page-head__eyebrow">Project</div>
          <h1>${escapeHtml(project.name)}</h1>
          <p class="page-head__sub">${escapeHtml(project.description || "No description yet.")}</p>
          <div class="row gap-4 mt-3 wrap fs-xs text-3">
            <span>${icon("check-circle", 12)} ${done}/${tasks.length} done</span>
            <span>${icon("calendar", 12)} ${project.deadline ? `Due ${escapeHtml(formatDate(project.deadline))}` : "No deadline"}</span>
            <span>${icon("users", 12)} ${(project.members || []).length} members</span>
          </div>
        </div>
        <div class="row gap-2">
          <div class="segmented">
            <button class="segmented__item${mode === "list" ? " is-active" : ""}" type="button" data-act="project-mode" data-mode="list">${icon("list", 14)} List</button>
            <button class="segmented__item${mode === "kanban" ? " is-active" : ""}" type="button" data-act="project-mode" data-mode="kanban">${icon("kanban", 14)} Board</button>
          </div>
          <button class="btn btn--primary" type="button" data-act="quick-add">${icon("plus", 15)} Add task</button>
          <button class="icon-btn" type="button" data-act="project-menu" data-project="${project.id}" data-tip="Project menu">${icon("more-h", 16)}</button>
        </div>
      </div>
      <div class="progress mt-4" style="max-width:420px"><div class="progress__bar" style="width:${pct}%;background:${project.color}"></div></div>
    </section>
    ${body}`;
}

/* ----------------------------------------------------------------- Render */
const quickAddBtn = `<button class="btn btn--primary" type="button" data-act="quick-add">${icon("plus", 15)} Quick add</button>`;

function renderList(key) {
  const config = LIST_VIEWS[key];
  return `${pageHead({ eyebrow: config.eyebrow, title: config.title, sub: config.sub, actions: quickAddBtn })}
    ${config.toolbar ? filtersBar() : ""}
    <div data-list>${listBody(key)}</div>`;
}

export function makeRender(key) {
  return (params = []) => {
    if (key === "projects") return projectsGrid();
    if (key === "project") return projectView(params[0], params);
    return renderList(key);
  };
}

/* Re-render hook shared with mount(). */
let pendingRerender = null;

function projectModal(existing = null) {
  const entry = modal({
    title: existing ? "Edit project" : "New project",
    subtitle: existing ? "Update the details." : "Give it a name — you can change everything later.",
    body: `
      <div class="col gap-4">
        <label class="field">
          <span class="field__label">Name</span>
          <input class="input" id="pm-name" maxlength="60" placeholder="e.g. Website redesign" value="${existing ? escapeHtml(existing.name) : ""}" autofocus />
        </label>
        <label class="field">
          <span class="field__label">Description</span>
          <textarea class="textarea" id="pm-desc" rows="3" placeholder="What is this project about?">${existing ? escapeHtml(existing.description || "") : ""}</textarea>
        </label>
      </div>`,
    footer: `
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="pm-save">${existing ? "Save changes" : "Create project"}</button>`,
    onMount: (node) => {
      const save = $("#pm-save", node);
      const name = $("#pm-name", node);
      const commit = () => {
        const value = name.value.trim();
        if (!value) { name.classList.add("has-error"); name.focus(); return; }
        const description = $("#pm-desc", node).value.trim();
        if (existing) { updateProject(existing.id, { name: value, description }); toast({ title: "Project updated", type: "success" }); }
        else { createProject({ name: value, description }); toast({ title: "Project created", type: "success" }); }
        entry.close();
        if (typeof pendingRerender === "function") pendingRerender();
      };
      save.addEventListener("click", commit);
      name.addEventListener("keydown", (event) => { if (event.key === "Enter") commit(); });
    }
  });
}

function projectMenu(anchor, projectId) {
  const project = getProject(projectId);
  if (!project) return;
  menu(anchor, [
    { label: "Open project", icon: "external", onClick: () => navigate("project", projectId) },
    { label: "Rename / edit", icon: "pencil", onClick: () => projectModal(project) },
    { label: project.favorite ? "Remove favourite" : "Add to favourites", icon: "star", onClick: () => { toggleProjectFavorite(projectId); if (pendingRerender) pendingRerender(); } },
    { type: "sep" },
    { label: project.archived ? "Restore" : "Archive", icon: "archive", onClick: () => { archiveProject(projectId); toast({ title: project.archived ? "Project restored" : "Project archived", type: "info" }); } },
    {
      label: "Delete project", icon: "trash", danger: true, onClick: async () => {
        const ok = await confirmDialog({ title: "Delete this project?", message: `“${project.name}” will be removed. Its tasks stay in the workspace.`, confirmLabel: "Delete", danger: true });
        if (ok) { deleteProject(projectId); toast({ title: "Project deleted", type: "info" }); navigate("projects"); if (pendingRerender) pendingRerender(); }
      }
    }
  ]);
}

/* ------------------------------------------------------------------- Mount */
export function makeMount(key) {
  return function mount(root, { rerender, params = [] } = {}) {
    pendingRerender = rerender;
    const refreshList = () => {
      const holder = $("[data-list]", root);
      if (holder) holder.innerHTML = listBody(key);
      else if (typeof rerender === "function") rerender();
    };

    bindTaskList(root, { onFocusTask: (taskId) => openFocusStage({ taskId }), onChanged: rerender });

    root.addEventListener("change", (event) => {
      const select = event.target.closest("[data-select]");
      if (!select) return;
      const name = select.dataset.select;
      const value = select.value;
      if (["status", "priority", "projectId", "tagId"].includes(name)) updateTaskFilters({ [name]: value });
      else if (name === "group") updateUi({ taskGroup: value });
      else if (name === "sort") updateUi({ taskSort: value });
      if (typeof rerender === "function") rerender();
    });

    root.addEventListener("input", (event) => {
      const field = event.target.closest("[data-filter='search']");
      if (!field) return;
      updateTaskFilters({ search: field.value });
      refreshList();
    });

    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-act]");
      if (action && !action.closest("[data-task]")) {
        switch (action.dataset.act) {
          case "quick-add":
            openQuickAdd({ onSaved: rerender });
            return;
          case "new-project":
            projectModal();
            return;
          case "open-project":
            navigate("project", action.dataset.project);
            return;
          case "go-projects":
            navigate("projects");
            return;
          case "project-menu":
            projectMenu(action, action.dataset.project);
            return;
          case "project-mode":
            navigate("project", params[0] || "", action.dataset.mode);
            return;
          case "add-to-column":
            openQuickAdd({ defaults: { columnId: action.dataset.column }, onSaved: rerender });
            return;
          case "view":
            updateUi({ taskView: action.dataset.view });
            if (typeof rerender === "function") rerender();
            return;
          default:
            break;
        }
      }
      const card = event.target.closest(".project-card[data-project]");
      if (card && !event.target.closest("[data-act]")) navigate("project", card.dataset.project);
    });

    /* Kanban drag & drop */
    let dragged = null;
    root.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-task][draggable]");
      if (!card) return;
      dragged = card.dataset.task;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragged);
    });
    root.addEventListener("dragend", (event) => {
      const card = event.target.closest("[data-task]");
      if (card) card.classList.remove("is-dragging");
      root.querySelectorAll(".is-over").forEach((node) => node.classList.remove("is-over"));
    });
    root.addEventListener("dragover", (event) => {
      const zone = event.target.closest("[data-droppable]");
      if (!zone) return;
      event.preventDefault();
      zone.classList.add("is-over");
    });
    root.addEventListener("dragleave", (event) => {
      const zone = event.target.closest("[data-droppable]");
      if (zone) zone.classList.remove("is-over");
    });
    root.addEventListener("drop", (event) => {
      const zone = event.target.closest("[data-droppable]");
      if (!zone) return;
      event.preventDefault();
      const taskId = event.dataTransfer.getData("text/plain") || dragged;
      if (taskId) {
        moveTask(taskId, { columnId: zone.dataset.droppable });
        toast({ title: "Task moved", type: "success", duration: 1400 });
        if (typeof rerender === "function") rerender();
      }
    });
  };
}

/* ------------------------------------------------------------------ Routes */
/* "My Day", "Today" and "Upcoming" remain reachable by URL (the dashboard links
   to them) but are intentionally kept out of the Plan navigation. */
const route = (name, title, iconName, group, order) => ({
  name, title, icon: iconName, group, order, nav: true,
  render: makeRender(name), mount: makeMount(name)
});
const hiddenRoute = (name, title, iconName, group, order) => ({
  name, title, icon: iconName, group, order, nav: false,
  render: makeRender(name), mount: makeMount(name)
});

export const routes = [
  hiddenRoute("inbox", "Inbox", "inbox", "Organise", 0),
  hiddenRoute("myday", "My Day", "sun", "Plan", 1),
  hiddenRoute("today", "Today", "check-circle", "Plan", 2),
  hiddenRoute("upcoming", "Upcoming", "calendar", "Plan", 3),
  hiddenRoute("tasks", "All tasks", "list", "Organise", 1),
  route("projects", "Projects", "folder", "Organise", 2),
  { name: "project", title: "Project", icon: "folder", group: "Organise", order: 3, nav: false, render: makeRender("project"), mount: makeMount("project") }
];
