/* ==========================================================================
   Elevate — Task composer: full editor modal + natural-language quick add
   ========================================================================== */
import { $, escapeHtml, formatDate, formatTime } from "./utils.js";
import { icon, PRIORITY_META } from "./icons.js";
import { modal, toast, validate } from "./ui.js";
import { parseTaskInput } from "./nlp.js";
import {
  createTask, updateTask, deleteTask, duplicateTask, getTask, getProjects, getTags, getSections,
  ensureTags, getState, currentUser, displayName
} from "./store.js";

const PRIORITIES = Object.keys(PRIORITY_META);

const options = (list, selected, placeholder = "None") => `
  <option value="">${escapeHtml(placeholder)}</option>
  ${list.map((item) => `<option value="${escapeHtml(item.value)}"${String(item.value) === String(selected) ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}`;

const tagChips = (task) => {
  const tags = getTags();
  if (!tags.length) return `<span class="text-3 fs-xs">No tags yet — add one from Settings → Tasks.</span>`;
  return `<div class="pill-row">${tags.map((tag) => `
    <button class="chip${task.tagIds.includes(tag.id) ? " is-active" : ""}" type="button" data-tag="${tag.id}">
      <span class="tag-dot" style="background:${tag.color}"></span>${escapeHtml(tag.name)}
    </button>`).join("")}</div>`;
};

const projectOptions = (selected) => options(
  getProjects().map((p) => ({ value: p.id, label: p.name })),
  selected || "",
  "No project (Inbox)"
);

const sectionOptions = (projectId, selected) => options(
  (projectId ? getSections(projectId) : []).map((s) => ({ value: s.id, label: s.name })),
  selected || "",
  "No section"
);

function taskFormBody(task) {
  const members = getState().team;
  const reminders = [
    { value: "0", label: "At due time" }, { value: "5", label: "5 minutes before" },
    { value: "15", label: "15 minutes before" }, { value: "60", label: "1 hour before" },
    { value: "1440", label: "1 day before" }
  ];
  const recurrences = [
    { value: "daily", label: "Every day" }, { value: "weekdays", label: "Every weekday" },
    { value: "weekly", label: "Every week" }, { value: "monthly", label: "Every month" },
    { value: "yearly", label: "Every year" }
  ];

  return `
    <div class="col gap-4">
      <div class="field">
        <label class="field__label" for="tf-title">Title <span class="req">*</span></label>
        <input class="input input--lg" id="tf-title" name="title" autofocus maxlength="180"
          placeholder="What needs to happen?" value="${escapeHtml(task.title || "")}">
        <div class="field__error"></div>
      </div>

      <div class="field">
        <label class="field__label" for="tf-desc">Description</label>
        <textarea class="textarea" id="tf-desc" name="description" rows="3" maxlength="900"
          placeholder="Add context, links or acceptance criteria…">${escapeHtml(task.description || "")}</textarea>
      </div>

      <div class="detail__grid">
        <div class="field">
          <label class="field__label" for="tf-due">${icon("calendar", 13)} Due date</label>
          <input class="input" id="tf-due" name="dueDate" type="date" value="${task.dueDate || ""}">
        </div>
        <div class="field">
          <label class="field__label" for="tf-time">${icon("clock", 13)} Due time</label>
          <input class="input" id="tf-time" name="dueTime" type="time" value="${task.dueTime || ""}">
        </div>
        <div class="field">
          <label class="field__label" for="tf-priority">${icon("flag", 13)} Priority</label>
          <select class="select" id="tf-priority" name="priority">
            ${PRIORITIES.map((p) => `<option value="${p}"${task.priority === p ? " selected" : ""}>${PRIORITY_META[p].label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="tf-estimate">${icon("timer", 13)} Estimate (minutes)</label>
          <input class="input" id="tf-estimate" name="estimatedMinutes" type="number" min="0" step="5"
            value="${task.estimatedMinutes || ""}" placeholder="30">
        </div>
        <div class="field">
          <label class="field__label" for="tf-project">${icon("folder", 13)} Project</label>
          <select class="select" id="tf-project" name="projectId">${projectOptions(task.projectId)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="tf-section">${icon("layout", 13)} Section</label>
          <select class="select" id="tf-section" name="sectionId">${sectionOptions(task.projectId, task.sectionId)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="tf-recurrence">${icon("repeat", 13)} Repeat</label>
          <select class="select" id="tf-recurrence" name="recurrenceFreq">
            ${options(recurrences, task.recurrence ? task.recurrence.freq : "", "Does not repeat")}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="tf-reminder">${icon("bell", 13)} Reminder</label>
          <select class="select" id="tf-reminder" name="reminder">
            ${options(reminders, task.reminder === null || task.reminder === undefined ? "" : String(task.reminder), "No reminder")}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="tf-location">${icon("pin", 13)} Location</label>
          <input class="input" id="tf-location" name="location" placeholder="Room, link or address" value="${escapeHtml(task.location || "")}">
        </div>
        <div class="field">
          <label class="field__label" for="tf-actual">${icon("check-circle", 13)} Actual (minutes)</label>
          <input class="input" id="tf-actual" name="actualMinutes" type="number" min="0" step="5" value="${task.actualMinutes || ""}">
        </div>
      </div>

      <div class="field">
        <span class="field__label">${icon("tag", 13)} Tags</span>
        ${tagChips(task)}
      </div>

      <div class="field">
        <span class="field__label">${icon("users", 13)} Assignees</span>
        <div class="pill-row">
          ${members.map((member) => `
            <button class="chip${task.assignees.includes(member.id) ? " is-active" : ""}" type="button" data-assignee="${member.id}">
              ${escapeHtml(displayName(member).split(" ")[0])} · ${escapeHtml(member.role)}
            </button>`).join("")}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="tf-notes">${icon("note", 13)} Notes</label>
        <textarea class="textarea" id="tf-notes" name="notes" rows="2" placeholder="Private notes, references, decisions…">${escapeHtml(task.notes || "")}</textarea>
      </div>
    </div>`;
}

/** Full create / edit experience for a single task. */
export function openTaskComposer({ task = null, defaults = {}, onSaved = null } = {}) {
  const existing = task ? getTask(task.id) : null;
  const isEdit = Boolean(existing);
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: null,
    title: defaults.title || "",
    description: "",
    notes: "",
    dueDate: defaults.dueDate || null,
    dueTime: defaults.dueTime || null,
    priority: defaults.priority || "none",
    projectId: defaults.projectId || null,
    sectionId: defaults.sectionId || null,
    tagIds: defaults.tagIds || [],
    estimatedMinutes: defaults.estimatedMinutes || 0,
    actualMinutes: 0,
    recurrence: defaults.recurrence || null,
    reminder: defaults.reminder === undefined ? getState().preferences.defaultReminder : defaults.reminder,
    location: defaults.location || "",
    assignees: defaults.assignees || [currentUser().id],
    myDay: Boolean(defaults.myDay),
    subtasks: [],
    attachments: [],
    dependsOn: [],
    comments: [],
    status: "todo",
    archived: false
  };

  return modal({
    title: isEdit ? "Edit task" : "New task",
    subtitle: isEdit ? "Changes are saved when you press Save." : "Only the title is required — the rest is optional.",
    size: "lg",
    body: `<form id="task-form" novalidate>${taskFormBody(draft)}</form>`,
    footer: `
      ${isEdit ? `<button class="btn btn--ghost" type="button" data-act="duplicate">${icon("copy", 15)} Duplicate</button>
        <button class="btn btn--ghost" type="button" data-act="archive">${icon("archive", 15)} Archive</button>
        <button class="btn btn--ghost" type="button" data-act="delete" style="color:var(--danger)">${icon("trash", 15)} Delete</button>` : ""}
      <span class="grow"></span>
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" data-act="save">${icon("check", 15)} ${isEdit ? "Save changes" : "Create task"}</button>
    `,
    onMount(node, api) {
      const form = $("#task-form", node);

      $('[name="projectId"]', form).addEventListener("change", (event) => {
        $('[name="sectionId"]', form).innerHTML = sectionOptions(event.target.value, null);
      });

      form.addEventListener("click", (event) => {
        const tagBtn = event.target.closest("[data-tag]");
        if (tagBtn) {
          const id = tagBtn.dataset.tag;
          draft.tagIds = draft.tagIds.includes(id) ? draft.tagIds.filter((t) => t !== id) : [...draft.tagIds, id];
          tagBtn.classList.toggle("is-active");
          return;
        }
        const assigneeBtn = event.target.closest("[data-assignee]");
        if (assigneeBtn) {
          const id = assigneeBtn.dataset.assignee;
          draft.assignees = draft.assignees.includes(id)
            ? draft.assignees.filter((a) => a !== id)
            : [...draft.assignees, id];
          assigneeBtn.classList.toggle("is-active");
        }
      });

      const collect = () => {
        const value = (name) => {
          const field = form.querySelector(`[name="${name}"]`);
          return field ? field.value.trim() : "";
        };
        const freq = value("recurrenceFreq");
        const reminderRaw = value("reminder");
        return {
          title: value("title"),
          description: value("description"),
          notes: value("notes"),
          dueDate: value("dueDate") || null,
          dueTime: value("dueTime") || null,
          priority: value("priority") || "none",
          projectId: value("projectId") || null,
          sectionId: value("sectionId") || null,
          estimatedMinutes: Number(value("estimatedMinutes")) || 0,
          actualMinutes: Number(value("actualMinutes")) || 0,
          location: value("location"),
          recurrence: freq ? { freq, interval: draft.recurrence ? draft.recurrence.interval || 1 : 1 } : null,
          reminder: reminderRaw === "" ? null : Number(reminderRaw),
          tagIds: draft.tagIds,
          assignees: draft.assignees.length ? draft.assignees : [currentUser().id]
        };
      };

      const save = () => {
        const valid = validate(form, {
          title: (v) => (v.length < 2 ? "Give your task a title (at least 2 characters)." : ""),
          estimatedMinutes: (v) => (v && Number(v) < 0 ? "Estimate cannot be negative." : ""),
          dueDate: (v) => (v && Number.isNaN(new Date(v).getTime()) ? "That date looks invalid." : "")
        });
        if (!valid) return;

        const payload = collect();
        if (isEdit) {
          updateTask(existing.id, payload);
          toast({ title: "Task updated", type: "success" });
        } else {
          createTask({ ...payload, myDay: draft.myDay });
          toast({
            title: "Task created",
            desc: payload.dueDate ? formatDate(payload.dueDate, "long") : "No due date set",
            type: "success"
          });
        }
        api.close();
        if (typeof onSaved === "function") onSaved(payload);
      };

      node.addEventListener("click", (event) => {
        const action = event.target.closest("[data-act]");
        if (!action || !isEdit) return;
        const kind = action.dataset.act;
        if (kind === "save") return;
        if (kind === "duplicate") {
          const copy = duplicateTask(existing.id);
          api.close();
          if (copy) toast({ title: "Task duplicated", desc: copy.title, type: "success" });
          if (typeof onSaved === "function") onSaved();
        }
        if (kind === "archive") {
          updateTask(existing.id, { archived: true, archivedAt: Date.now() });
          api.close();
          toast({ title: "Task archived", desc: "Find it under Archived.", type: "info" });
          if (typeof onSaved === "function") onSaved();
        }
        if (kind === "delete") {
          deleteTask(existing.id);
          api.close();
          toast({ title: "Task deleted", type: "info" });
          if (typeof onSaved === "function") onSaved();
        }
      });
      node.addEventListener("click", (event) => {
        if (event.target.closest('[data-act="save"]')) save();
      });

      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") save();
      });
    }
  });
}

/**
 * Natural-language quick add. Type "Submit report tomorrow at 10am !urgent #work"
 * and Elevate fills in the date, time, priority and tags for you.
 */
export function openQuickAdd({ defaults = {}, onSaved = null } = {}) {
  let parsed = parseTaskInput("");

  const EXAMPLES = [
    "Submit project report tomorrow at 10am",
    "Call Sarah every Monday at 9am",
    "Finish proposal by Friday",
    "Pay rent on the 1st #finance"
  ];

  return modal({
    title: "Quick add",
    subtitle: "Write it the way you would say it — Elevate fills in the details.",
    size: "md",
    align: "top",
    body: `
      <div class="col gap-3">
        <div class="field">
          <input class="input input--lg" id="qa-input" autofocus maxlength="200"
            placeholder="e.g. Call Sarah every Monday at 9am #work" value="${escapeHtml(defaults.title || "")}">
          <div class="field__error"></div>
        </div>
        <div id="qa-preview"></div>
        <div class="pill-row" id="qa-examples"></div>
      </div>`,
    footer: `
      <button class="btn btn--ghost" type="button" data-act="details">${icon("layout", 15)} Full editor</button>
      <span class="grow"></span>
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" data-act="create">${icon("check", 15)} Add task</button>
    `,
    onMount(node, api) {
      const input = $("#qa-input", node);
      const preview = $("#qa-preview", node);
      const examples = $("#qa-examples", node);
      examples.innerHTML = EXAMPLES.map((ex) => `<button class="chip" type="button" data-example="${escapeHtml(ex)}">${escapeHtml(ex)}</button>`).join("");

      const renderPreview = () => {
        parsed = parseTaskInput(input.value);
        if (!input.value.trim()) {
          preview.innerHTML = `<p class="fs-xs text-3">Try: ${escapeHtml(EXAMPLES[0])}</p>`;
          return;
        }
        const chips = [
          parsed.dueDate ? `${icon("calendar", 12)} ${escapeHtml(formatDate(parsed.dueDate, "long"))}` : "",
          parsed.dueTime ? `${icon("clock", 12)} ${escapeHtml(formatTime(parsed.dueTime))}` : "",
          parsed.recurrence ? `${icon("repeat", 12)} ${escapeHtml(parsed.recurrenceLabel || parsed.recurrence.freq)}` : "",
          parsed.priority ? `${icon("flag", 12)} ${escapeHtml(PRIORITY_META[parsed.priority].label)}` : "",
          parsed.estimate ? `${icon("timer", 12)} ${escapeHtml(String(parsed.estimate))} min` : "",
          ...parsed.tagNames.map((t) => `${icon("tag", 12)} ${escapeHtml(t)}`)
        ].filter(Boolean);

        preview.innerHTML = `
          <div class="well">
            <div class="eyebrow mb-2">We understood</div>
            <div class="strong fs-sm">${escapeHtml(parsed.title || input.value)}</div>
            ${chips.length
    ? `<div class="pill-row mt-2">${chips.map((c) => `<span class="chip chip--sm">${c}</span>`).join("")}</div>`
    : '<p class="fs-xs text-3 mt-2">No date detected yet — try “tomorrow”, “Friday at 4pm” or “every Monday”.</p>'}
          </div>`;
      };

      const create = () => {
        const value = input.value.trim();
        const field = input.closest(".field");
        if (value.length < 2) {
          field.classList.add("has-error");
          $(".field__error", field).innerHTML = `${icon("alert", 12)} Give your task a title first.`;
          input.classList.add("shake");
          setTimeout(() => input.classList.remove("shake"), 450);
          input.focus();
          return;
        }
        field.classList.remove("has-error");
        parsed = parseTaskInput(value);
        const task = createTask({
          title: parsed.title || value,
          dueDate: parsed.dueDate || defaults.dueDate || null,
          dueTime: parsed.dueTime || defaults.dueTime || null,
          priority: parsed.priority || defaults.priority || "none",
          recurrence: parsed.recurrence || null,
          estimatedMinutes: parsed.estimate || 0,
          location: parsed.location || "",
          projectId: defaults.projectId || null,
          sectionId: defaults.sectionId || null,
          tagIds: [...ensureTags(parsed.tagNames), ...(defaults.tagIds || [])],
          myDay: Boolean(defaults.myDay)
        });
        api.close();
        toast({
          title: "Task added",
          desc: task.dueDate
            ? `${formatDate(task.dueDate, "long")}${task.dueTime ? ` · ${formatTime(task.dueTime)}` : ""}`
            : "No due date",
          type: "success"
        });
        if (typeof onSaved === "function") onSaved(task.id);
      };

      input.addEventListener("input", renderPreview);

      node.addEventListener("click", (event) => {
        const example = event.target.closest("[data-example]");
        if (example) {
          input.value = example.dataset.example;
          renderPreview();
          input.focus();
          return;
        }
        if (event.target.closest('[data-act="create"]')) { create(); return; }
        if (event.target.closest('[data-act="details"]')) {
          const title = parsed.title || input.value.trim();
          api.close();
          openTaskComposer({
            defaults: {
              title,
              dueDate: parsed.dueDate || defaults.dueDate || null,
              dueTime: parsed.dueTime || defaults.dueTime || null,
              priority: parsed.priority || defaults.priority || "none",
              projectId: defaults.projectId || null,
              tagIds: ensureTags(parsed.tagNames),
              estimatedMinutes: parsed.estimate || 0
            },
            onSaved
          });
        }
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); create(); }
      });

      renderPreview();
    }
  });
}

/** Opens the composer for an existing task (used by menus, search and rows). */
export const editTask = (id, options = {}) => openTaskComposer({ task: getTask(id), ...options });





