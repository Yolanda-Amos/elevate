/* ==========================================================================
   Elevate — Calendar: month grid, week/day time grid, agenda, events
   ========================================================================== */
import {
  escapeHtml, todayISO, formatDate, monthMatrix, weekDates, addDays, toMinutes,
  nowHHMM, parseISO, formatTime, rangeDates, WEEKDAYS_SHORT, clamp, $
} from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, toast, modal, confirmDialog } from "../ui.js";
import { openQuickAdd } from "../taskform.js";
import { bindTaskList } from "../taskrows.js";
import { navigate } from "../router.js";
import {
  getUi, updateUi, getPreferences, getEventsForDate, getEvents, createEvent, updateEvent,
  deleteEvent, tasksDueOn, tasksWithBlocks, getHabits, habitValue, isHabitScheduled
} from "../store.js";

const HOURS = Array.from({ length: 17 }, (_, index) => index + 6); /* 06:00 – 22:00 */

const shiftDate = (date, view, delta) => {
  if (view === "month") {
    const target = parseISO(date);
    target.setDate(1);
    target.setMonth(target.getMonth() + delta);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (view === "agenda") return addDays(date, delta * 7);
  return addDays(date, delta);
};

function dayItems(date) {
  const items = [];
  tasksDueOn(date, { includeDone: true }).forEach((task) => {
    const overdue = task.status !== "done" && task.dueDate < todayISO();
    items.push({
      kind: "task", id: task.id, date, title: task.title, start: task.dueTime || task.timeBlock?.start || "",
      cls: task.status === "done" ? "cal__event--done" : overdue ? "cal__event--overdue" : ""
    });
  });
  getEventsForDate(date).forEach((event) => {
    items.push({ kind: "event", id: event.id, date, title: event.title, start: event.start, cls: "cal__event--event" });
  });
  getHabits().forEach((habit) => {
    if (habitValue(habit.id, date) >= habit.target && isHabitScheduled(habit, date)) {
      items.push({ kind: "habit", id: habit.id, date, title: habit.name, start: "", cls: "cal__event--habit" });
    }
  });
  return items.sort((a, b) => (a.start || "23:59").localeCompare(b.start || "23:59"));
}

/* ------------------------------------------------------------ Month grid */
function monthView(date) {
  const weekStart = getPreferences().startOfWeek ?? 1;
  const grid = monthMatrix(date, weekStart);
  const today = todayISO();
  const dows = Array.from({ length: 7 }, (_, index) => WEEKDAYS_SHORT[(weekStart + index) % 7]);
  return `
    <div class="cal">
      <div class="cal__head">${dows.map((dow) => `<div class="cal__dow">${escapeHtml(dow)}</div>`).join("")}</div>
      <div class="cal__body">
        ${grid.map((cell) => {
    const outside = cell.slice(0, 7) !== date.slice(0, 7);
    const items = dayItems(cell);
    const shown = items.slice(0, 3);
    return `
            <div class="cal__cell${outside ? " is-outside" : ""}${cell === today ? " is-today" : ""}" data-date="${cell}">
              <div class="cal__date">${Number(cell.slice(8))}</div>
              <div class="cal__events">
                ${shown.map((item) => `
                  <div class="cal__event ${item.cls}" ${item.kind === "task" ? `data-task="${item.id}"` : `data-${item.kind}="${item.id}" data-act="open-${item.kind}"`} title="${escapeHtml(item.title)}">
                    ${item.start ? `<span class="tnum">${escapeHtml(formatTime(item.start, { compact: true }))}</span>` : ""}${escapeHtml(item.title)}
                  </div>`).join("")}
                ${items.length > 3 ? `<div class="cal__more">+${items.length - 3} more</div>` : ""}
              </div>
            </div>`;
  }).join("")}
      </div>
    </div>
    <div class="cal-legend">
      <span class="cal-legend__item"><span class="cal-legend__swatch" style="background:var(--accent)"></span>Tasks</span>
      <span class="cal-legend__item"><span class="cal-legend__swatch" style="background:var(--info)"></span>Events</span>
      <span class="cal-legend__item"><span class="cal-legend__swatch" style="background:var(--success)"></span>Habits</span>
      <span class="cal-legend__item"><span class="cal-legend__swatch" style="background:var(--danger)"></span>Overdue</span>
    </div>`;
}

/* --------------------------------------------------- Week / day time grid */
function blockStyle(start, end) {
  const top = clamp(toMinutes(start) - HOURS[0] * 60, 0, (HOURS[HOURS.length - 1] + 1 - HOURS[0]) * 60);
  const duration = Math.max(30, toMinutes(end || fromMinutesSafe(start)) - toMinutes(start));
  return `top:${top}px;height:${Math.min(duration, (HOURS[HOURS.length - 1] + 1) * 60 - HOURS[0] * 60 - top)}px`;
}
const fromMinutesSafe = (start) => {
  const mins = toMinutes(start) + 60;
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

function timeGrid(dates) {
  const today = todayISO();
  const now = toMinutes(nowHHMM());
  const showNow = dates.includes(today) && now >= HOURS[0] * 60 && now <= (HOURS[HOURS.length - 1] + 1) * 60;
  return `
    <div class="tgrid">
      <div class="tgrid__head">
        <div class="tgrid__gutter"></div>
        ${dates.map((date) => `
          <div class="tgrid__day${date === today ? " is-today" : ""}">
            <div class="tgrid__day-name">${WEEKDAYS_SHORT[parseISO(date).getDay()]}</div>
            <div class="tgrid__day-num">${Number(date.slice(8))}</div>
          </div>`).join("")}
      </div>
      <div class="tgrid__body">
        <div class="tgrid__hours">
          ${HOURS.map((hour) => `<div class="tgrid__hour-label">${String(hour).padStart(2, "0")}:00</div>`).join("")}
        </div>
        <div class="tgrid__cols">
          ${dates.map((date) => `
            <div class="tgrid__col" data-day="${date}">
              ${HOURS.map((hour) => `<div class="tgrid__slot" data-slot="${date}T${String(hour).padStart(2, "0")}:00"></div>`).join("")}
              ${showNow && date === today ? `<div class="tgrid__now" style="top:${now - HOURS[0] * 60}px"></div>` : ""}
              ${tasksWithBlocks(date).map((task) => `
                <div class="tgrid__block${task.status === "done" ? " tgrid__block--done" : ""}" data-task="${task.id}"
                  style="${blockStyle(task.timeBlock.start, task.timeBlock.end)}">
                  ${escapeHtml(formatTime(task.timeBlock.start, { compact: true }))} ${escapeHtml(task.title)}
                </div>`).join("")}
              ${getEventsForDate(date).map((event) => `
                <div class="tgrid__block tgrid__block--event" data-event="${event.id}" style="${blockStyle(event.start, event.end)}">
                  ${escapeHtml(formatTime(event.start, { compact: true }))} ${escapeHtml(event.title)}
                </div>`).join("")}
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

/* ----------------------------------------------------------------- Agenda */
function agendaView(date) {
  const days = rangeDates(date, addDays(date, 13));
  const rows = days.map((day) => ({ day, items: dayItems(day) }));
  const active = rows.filter((row) => row.items.length);
  if (!active.length) {
    return emptyState({ icon: "calendar", title: "Nothing scheduled", text: "The next two weeks are wide open.", actions: `<button class="btn btn--primary btn--sm" type="button" data-act="new-event">${icon("plus", 14)} Add event</button>` });
  }
  return `<div class="list">${active.map(({ day, items }) => `
    <section class="list__group">
      <div class="list__group-head">
        <span class="list__group-head-title" style="font-size:var(--fs-sm);font-weight:600">
          ${escapeHtml(formatDate(day, "long"))}${day === todayISO() ? " · Today" : ""}
        </span>
        <span class="count">${items.length}</span>
        <span class="line"></span>
      </div>
      <div class="col gap-2">
        ${items.map((item) => `
          <div class="block-row" ${item.kind === "task" ? `data-task="${item.id}"` : `data-${item.kind}="${item.id}" data-act="open-${item.kind}"`}>
            <span class="block-row__time">${item.start ? escapeHtml(formatTime(item.start)) : "All day"}</span>
            <span class="cal-legend__swatch" style="background:${item.kind === "event" ? "var(--info)" : item.kind === "habit" ? "var(--success)" : item.cls.includes("overdue") ? "var(--danger)" : "var(--accent)"}"></span>
            <span class="grow truncate ${item.cls.includes("done") ? "text-3" : ""}">${escapeHtml(item.title)}</span>
            <span class="fs-2xs text-3">${item.kind === "task" ? "Task" : item.kind === "event" ? "Event" : "Habit"}</span>
          </div>`).join("")}
      </div>
    </section>`).join("")}</div>`;
}

/* ----------------------------------------------------------------- Render */
const VIEWS = [
  { value: "month", label: "Month" }, { value: "week", label: "Week" },
  { value: "day", label: "Day" }, { value: "agenda", label: "Agenda" }
];

function viewLabel(date, view) {
  if (view === "month") return formatDate(`${date.slice(0, 7)}-01`, "month");
  if (view === "day") return formatDate(date, "long");
  if (view === "week") {
    const days = weekDates(date, getPreferences().startOfWeek ?? 1);
    return `${formatDate(days[0], "day")} – ${formatDate(days[6], "day")}`;
  }
  return `${formatDate(date, "day")} + 2 weeks`;
}

export function render() {
  const ui = getUi();
  const date = ui.calendarDate || todayISO();
  const view = ui.calendarView || "month";
  const body = view === "month" ? monthView(date)
    : view === "week" ? timeGrid(weekDates(date, getPreferences().startOfWeek ?? 1))
      : view === "day" ? timeGrid([date])
        : agendaView(date);

  return `
    <header class="page-head">
      <div class="page-head__main">
        <div class="page-head__eyebrow">Organise</div>
        <h1>Calendar</h1>
        <p class="page-head__sub">Time blocks, meetings, deadlines and habits in one place.</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" type="button" data-act="new-task">${icon("check-circle", 15)} Task</button>
        <button class="btn btn--primary" type="button" data-act="new-event">${icon("plus", 15)} Event</button>
      </div>
    </header>

    <div class="cal-toolbar">
      <button class="icon-btn" type="button" data-act="prev" aria-label="Previous">${icon("chevron-left", 16)}</button>
      <button class="icon-btn" type="button" data-act="next" aria-label="Next">${icon("chevron-right", 16)}</button>
      <button class="btn btn--sm" type="button" data-act="today">Today</button>
      <span class="cal-label">${escapeHtml(viewLabel(date, view))}</span>
      <span class="toolbar__spacer"></span>
      <div class="segmented">
        ${VIEWS.map((item) => `
          <button class="segmented__item${view === item.value ? " is-active" : ""}" type="button" data-act="cal-view" data-view="${item.value}">
            ${escapeHtml(item.label)}
          </button>`).join("")}
      </div>
    </div>

    <div data-cal>${body}</div>`;
}

/* --CAL-END-- */

/* ------------------------------------------------------------ Event modal */
function eventModal(existing = null, date = todayISO()) {
  return modal({
    title: existing ? "Edit event" : "New event",
    subtitle: existing ? "Update the details." : "Meetings, calls and anything with a time.",
    body: `
      <div class="col gap-4">
        <label class="field"><span class="field__label">Title</span>
          <input class="input" id="ev-title" maxlength="80" placeholder="e.g. Design review" value="${existing ? escapeHtml(existing.title) : ""}" autofocus /></label>
        <div class="detail__grid">
          <label class="field"><span class="field__label">Date</span>
            <input class="input" id="ev-date" type="date" value="${existing ? existing.date : date}" /></label>
          <label class="field"><span class="field__label">Start</span>
            <input class="input" id="ev-start" type="time" value="${existing ? existing.start : "10:00"}" /></label>
          <label class="field"><span class="field__label">End</span>
            <input class="input" id="ev-end" type="time" value="${existing ? existing.end : "11:00"}" /></label>
          <label class="field"><span class="field__label">Location</span>
            <input class="input" id="ev-loc" maxlength="60" placeholder="Zoom, Studio…" value="${existing ? escapeHtml(existing.location || "") : ""}" /></label>
        </div>
      </div>`,
    footer: `
      ${existing ? `<button class="btn btn--danger" type="button" id="ev-delete">Delete</button>` : ""}
      <span class="grow"></span>
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="ev-save">${existing ? "Save changes" : "Create event"}</button>`,
    onMount: (node, overlay) => {
      const commit = () => {
        const title = $("#ev-title", node).value.trim();
        if (!title) { $("#ev-title", node).classList.add("has-error"); return; }
        const patch = {
          title,
          date: $("#ev-date", node).value || date,
          start: $("#ev-start", node).value || "10:00",
          end: $("#ev-end", node).value || "11:00",
          location: $("#ev-loc", node).value.trim()
        };
        if (existing) { updateEvent(existing.id, patch); toast({ title: "Event updated", type: "success" }); }
        else { createEvent(patch); toast({ title: "Event created", type: "success" }); }
        overlay.close();
        if (typeof rerenderRef === "function") rerenderRef();
      };
      $("#ev-save", node).addEventListener("click", commit);
      const remove = $("#ev-delete", node);
      if (remove) {
        remove.addEventListener("click", async () => {
          const ok = await confirmDialog({ title: "Delete event?", message: `“${existing.title}” will be removed.`, confirmLabel: "Delete", danger: true });
          if (ok) {
            deleteEvent(existing.id);
            overlay.close();
            toast({ title: "Event deleted", type: "info" });
            if (typeof rerenderRef === "function") rerenderRef();
          }
        });
      }
    }
  });
}

let rerenderRef = null;


/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  rerenderRef = rerender;
  bindTaskList(root, { onChanged: rerender });

  const setDate = (date) => {
    updateUi({ calendarDate: date });
    if (typeof rerender === "function") rerender();
  };

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (action && !action.closest("[data-task]")) {
      switch (action.dataset.act) {
        case "prev":
          setDate(shiftDate(getUi().calendarDate, getUi().calendarView, -1));
          return;
        case "next":
          setDate(shiftDate(getUi().calendarDate, getUi().calendarView, 1));
          return;
        case "today":
          setDate(todayISO());
          return;
        case "cal-view":
          updateUi({ calendarView: action.dataset.view });
          if (typeof rerender === "function") rerender();
          return;
        case "new-event":
          eventModal(null, getUi().calendarDate || todayISO());
          return;
        case "new-task":
          openQuickAdd({ defaults: { dueDate: getUi().calendarDate || todayISO() }, onSaved: rerender });
          return;
        case "open-event": {
          const found = getEvents().find((item) => item.id === action.dataset.event);
          if (found) eventModal(found);
          return;
        }
        case "open-habit":
          navigate("habits");
          return;
        default:
          break;
      }
    }
    const cell = event.target.closest(".cal__cell[data-date]");
    if (cell && !event.target.closest("[data-task], [data-event], [data-habit]")) {
      updateUi({ calendarView: "day", calendarDate: cell.dataset.date });
      if (typeof rerender === "function") rerender();
      return;
    }
    const slot = event.target.closest("[data-slot]");
    if (slot) blockPrompt(slot.dataset.slot, rerender);
  });
}

function blockPrompt(slot, rerender) {
  const date = slot.slice(0, 10);
  const time = slot.slice(11, 16);
  modal({
    title: "Quick time block",
    subtitle: `${formatDate(date, "day")} · ${formatTime(time)}`,
    body: `<label class="field"><span class="field__label">What will you work on?</span>
      <input class="input" id="blk-title" maxlength="80" placeholder="Deep work…" autofocus /></label>`,
    size: "sm",
    footer: `<button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="blk-save">Add block</button>`,
    onMount: (node, overlay) => {
      const save = () => {
        const title = $("#blk-title", node).value.trim();
        if (!title) return;
        const endHour = Math.min(23, Number(time.slice(0, 2)) + 1);
        overlay.close();
        openQuickAdd({
          defaults: {
            title, dueDate: date, dueTime: time,
            timeBlock: { date, start: time, end: `${String(endHour).padStart(2, "0")}:00` }
          },
          onSaved: rerender
        });
      };
      $("#blk-save", node).addEventListener("click", save);
      $("#blk-title", node).addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "calendar",
  title: "Calendar",
  icon: "calendar",
  group: "Organise",
  order: 4,
  nav: true,
  render,
  mount
}];

