/* ==========================================================================
   Elevate — Habits: streaks, check-ins, cadence and habit history
   ========================================================================== */
import { escapeHtml, todayISO, addDays, parseISO, WEEKDAYS_SHORT, $ } from "../utils.js";
import { icon, SWATCHES, PICKABLE_ICONS } from "../icons.js";
import { emptyState, toast, modal, menu, confirmDialog, progressBar } from "../ui.js";
import { navigate } from "../router.js";
import {
  getHabits, getHabit, createHabit, updateHabit, deleteHabit, toggleHabit, habitValue,
  isHabitScheduled, habitStreak, habitCompletion, habitsScheduledOn
} from "../store.js";

const CADENCES = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "custom", label: "Custom days" }
];

const last7 = () => Array.from({ length: 7 }, (_, index) => addDays(todayISO(), index - 6));

/* ------------------------------------------------------------ Habit cards */
function habitCard(habit, rerender) {
  const streak = habitStreak(habit.id);
  const completion = habitCompletion(habit.id, 30);
  const value = habitValue(habit.id, todayISO());
  const done = value >= habit.target;
  const scheduledToday = isHabitScheduled(habit, todayISO());
  return `
    <article class="card habit-card" data-habit-card="${habit.id}">
      <div class="habit-card__top">
        <span class="habit-card__icon" style="background:${habit.color}1a;color:${habit.color}">${icon(habit.icon, 17)}</span>
        <div class="grow">
          <div class="strong">${escapeHtml(habit.name)}</div>
          <div class="fs-2xs text-3">${escapeHtml(CADENCES.find((c) => c.value === habit.cadence)?.label || habit.cadence)} · target ${habit.target} ${escapeHtml(habit.unit)}</div>
        </div>
        <span class="streak-badge">${icon("flame", 11)} ${streak.current}</span>
        <button class="icon-btn" type="button" data-act="habit-menu" data-habit="${habit.id}" data-tip="More">${icon("more-h", 15)}</button>
      </div>

      <div class="habit-checks">
        ${last7().map((date) => {
    const scheduled = isHabitScheduled(habit, date);
    const hit = habitValue(habit.id, date) >= habit.target;
    return `<button class="habit-chip${hit ? " is-done" : ""}" type="button" data-act="habit-day" data-habit="${habit.id}" data-date="${date}"
              data-tip="${escapeHtml(formatDateShort(date))}${scheduled ? "" : " (rest day)"}">${parseISO(date).getDate()}</button>`;
  }).join("")}
      </div>

      <div class="habit-card__stats">
        <div class="habit-card__stat"><b>${streak.current}</b><span>Current</span></div>
        <div class="habit-card__stat"><b>${streak.best}</b><span>Best</span></div>
        <div class="habit-card__stat"><b>${completion.percent}%</b><span>30-day</span></div>
      </div>

      <div class="row gap-2">
        ${scheduledToday
      ? `<button class="btn ${done ? "btn--soft" : "btn--primary"} btn--sm grow" type="button" data-act="habit-toggle" data-habit="${habit.id}">
              ${done ? `${icon("check", 14)} Done · undo` : `${icon("plus", 14)} Log ${habit.target} ${escapeHtml(habit.unit)}`}</button>`
      : `<span class="fs-2xs text-3 grow">${icon("moon", 12)} Rest day</span>`}
        <button class="btn btn--ghost btn--sm" type="button" data-act="habit-edit" data-habit="${habit.id}">${icon("pencil", 13)} Edit</button>
      </div>
    </article>`;
}

const formatDateShort = (date) =>
  `${WEEKDAYS_SHORT[parseISO(date).getDay()]} ${parseISO(date).getDate()}`;

function todayStrip() {
  const habits = getHabits().filter((habit) => isHabitScheduled(habit, todayISO()));
  if (!habits.length) return "";
  const doneCount = habits.filter((habit) => habitValue(habit.id, todayISO()) >= habit.target).length;
  return `
    <section class="card card--pad">
      <div class="row-between mb-3">
        <div>
          <h3 class="card-title">Today's check-in</h3>
          <div class="card-sub">${doneCount}/${habits.length} complete · ${habitsScheduledOn(todayISO())} scheduled</div>
        </div>
        ${progressBar(habits.length ? (doneCount / habits.length) * 100 : 0, doneCount === habits.length ? "progress--success" : "")}
      </div>
      <div class="row gap-2 wrap">
        ${habits.map((habit) => {
    const value = habitValue(habit.id, todayISO());
    const done = value >= habit.target;
    return `
            <button class="habit-chip${done ? " is-done" : ""}" type="button" data-act="habit-toggle" data-habit="${habit.id}"
              style="width:auto;padding:0 12px;gap:6px">
              ${icon(habit.icon, 13)} ${escapeHtml(habit.name)}${habit.target > 1 ? ` · ${value}/${habit.target}` : ""}
            </button>`;
  }).join("")}
      </div>
    </section>`;
}

/* ----------------------------------------------------------------- Render */
export function render() {
  const habits = getHabits();
  const active = habits.filter((habit) => !habit.archived);
  const totalStreaks = active.reduce((sum, habit) => sum + habitStreak(habit.id).current, 0);

  return `
    <div class="col gap-5">
      <header class="page-head">
        <div class="page-head__main">
          <div class="page-head__eyebrow">Grow</div>
          <h1>Habits</h1>
          <p class="page-head__sub">Small actions, repeated. ${active.length} active habit${active.length === 1 ? "" : "s"} · ${totalStreaks} combined day streak.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-act="new-habit">${icon("plus", 15)} New habit</button>
        </div>
      </header>

      ${todayStrip()}

      ${active.length
      ? `<div class="project-grid" style="grid-template-columns:repeat(auto-fill,minmax(288px,1fr))">
          ${active.map((habit) => habitCard(habit)).join("")}
        </div>`
      : emptyState({
        icon: "repeat", title: "No habits yet",
        text: "Habits are the compound interest of self-improvement. Start with one tiny daily action.",
        actions: `<button class="btn btn--primary btn--sm" type="button" data-act="new-habit">${icon("plus", 14)} Create your first habit</button>`
      })}
    </div>`;
}

let pendingRerender = null;

/* ------------------------------------------------------------- Habit modal */
function habitModal(existing = null) {
  let iconChoice = existing ? existing.icon : "spark";
  let colorChoice = existing ? existing.color : SWATCHES[0].hex;
  let days = existing ? [...existing.days] : [0, 1, 2, 3, 4, 5, 6];

  modal({
    title: existing ? "Edit habit" : "New habit",
    subtitle: "Pick a cadence you can actually keep.",
    body: `
      <div class="col gap-4">
        <label class="field"><span class="field__label">Name</span>
          <input class="input" id="hb-name" maxlength="48" placeholder="e.g. Read 20 pages" value="${existing ? escapeHtml(existing.name) : ""}" autofocus /></label>
        <div class="detail__grid">
          <label class="field"><span class="field__label">Cadence</span>
            <select class="select" id="hb-cadence">
              ${CADENCES.map((option) => `<option value="${option.value}"${(existing ? existing.cadence : "daily") === option.value ? " selected" : ""}>${option.label}</option>`).join("")}
            </select></label>
          <label class="field"><span class="field__label">Target</span>
            <input class="input" id="hb-target" type="number" min="1" max="999" value="${existing ? existing.target : 1}" /></label>
          <label class="field"><span class="field__label">Unit</span>
            <input class="input" id="hb-unit" maxlength="16" placeholder="times, pages…" value="${existing ? escapeHtml(existing.unit) : "times"}" /></label>
          <label class="field"><span class="field__label">Reminder</span>
            <input class="input" id="hb-reminder" type="time" value="${existing ? escapeHtml(existing.reminder || "") : ""}" /></label>
        </div>
        <div class="col gap-2">
          <span class="field__label">Days</span>
          <div class="row gap-2">
            ${WEEKDAYS_SHORT.map((label, index) => `
              <button class="habit-chip" type="button" data-day="${index}" style="${days.includes(index) ? "background:var(--accent);border-color:var(--accent);color:var(--accent-on)" : ""}">${label[0]}</button>`).join("")}
          </div>
        </div>
        <div class="col gap-2">
          <span class="field__label">Colour</span>
          <div class="accent-row">
            ${SWATCHES.slice(0, 8).map((swatch) => `
              <button class="accent-dot${swatch.hex === colorChoice ? " is-active" : ""}" type="button" data-color="${swatch.hex}"
                style="background:${swatch.hex};color:${swatch.hex}" aria-label="${swatch.name}"></button>`).join("")}
          </div>
        </div>
        <div class="col gap-2">
          <span class="field__label">Icon</span>
          <div class="row gap-2 wrap">
            ${PICKABLE_ICONS.slice(0, 10).map((name) => `
              <button class="icon-btn${name === iconChoice ? " is-active" : ""}" type="button" data-icon="${name}"
                style="${name === iconChoice ? "background:var(--accent-soft);color:var(--accent-ink)" : ""}">${icon(name, 15)}</button>`).join("")}
          </div>
        </div>
      </div>`,
    footer: `
      ${existing ? `<button class="btn btn--danger" type="button" id="hb-delete">Delete</button>` : ""}
      <span class="grow"></span>
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="hb-save">${existing ? "Save" : "Create habit"}</button>`,
    onMount: (node, overlay) => {
      node.addEventListener("click", (event) => {
        const day = event.target.closest("[data-day]");
        if (day) {
          const index = Number(day.dataset.day);
          days = days.includes(index) ? days.filter((d) => d !== index) : [...days, index];
          day.style.cssText = days.includes(index)
            ? "background:var(--accent);border-color:var(--accent);color:var(--accent-on)" : "";
        }
        const color = event.target.closest("[data-color]");
        if (color) {
          colorChoice = color.dataset.color;
          node.querySelectorAll("[data-color]").forEach((dot) => dot.classList.toggle("is-active", dot === color));
        }
        const pick = event.target.closest("[data-icon]");
        if (pick) {
          iconChoice = pick.dataset.icon;
          node.querySelectorAll("[data-icon]").forEach((btn) => {
            const on = btn === pick;
            btn.classList.toggle("is-active", on);
            btn.style.cssText = on ? "background:var(--accent-soft);color:var(--accent-ink)" : "";
          });
        }
      });

/* --HABITS-END-- */

      const commit = () => {
        const name = $("#hb-name", node).value.trim();
        if (!name) { $("#hb-name", node).classList.add("has-error"); return; }
        const cadence = $("#hb-cadence", node).value;
        const payload = {
          name, icon: iconChoice, color: colorChoice, cadence,
          days: cadence === "weekdays" ? [1, 2, 3, 4, 5]
            : cadence === "weekends" ? [0, 6]
              : cadence === "daily" ? [0, 1, 2, 3, 4, 5, 6] : (days.length ? days : [0, 1, 2, 3, 4, 5, 6]),
          target: Math.max(1, Number($("#hb-target", node).value) || 1),
          unit: $("#hb-unit", node).value.trim() || "times",
          reminder: $("#hb-reminder", node).value || ""
        };
        if (existing) { updateHabit(existing.id, payload); toast({ title: "Habit updated", type: "success" }); }
        else { createHabit(payload); toast({ title: "Habit created", type: "success" }); }
        overlay.close();
        if (typeof pendingRerender === "function") pendingRerender();
      };
      $("#hb-save", node).addEventListener("click", commit);
      $("#hb-name", node).addEventListener("keydown", (event) => { if (event.key === "Enter") commit(); });

      const remove = $("#hb-delete", node);
      if (remove) {
        remove.addEventListener("click", async () => {
          const ok = await confirmDialog({ title: "Delete habit?", message: `“${existing.name}” and its history will be removed.`, confirmLabel: "Delete", danger: true });
          if (ok) {
            deleteHabit(existing.id);
            overlay.close();
            toast({ title: "Habit deleted", type: "info" });
            if (typeof pendingRerender === "function") pendingRerender();
          }
        });
      }
    }
  });
}


/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  pendingRerender = rerender;

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    const habitId = action.dataset.habit;
    switch (action.dataset.act) {
      case "new-habit":
        habitModal();
        break;
      case "habit-edit":
        habitModal(getHabit(habitId));
        break;
      case "habit-toggle": {
        const value = toggleHabit(habitId);
        const habit = getHabit(habitId);
        if (value > 0) toast({ title: "Habit logged", desc: `${habit.name} · ${value}/${habit.target}`, type: "success", duration: 1700 });
        if (typeof rerender === "function") rerender();
        break;
      }
      case "habit-day": {
        const date = action.dataset.date;
        toggleHabit(habitId, date);
        if (typeof rerender === "function") rerender();
        break;
      }
      case "habit-menu": {
        const habit = getHabit(habitId);
        menu(action, [
          { label: "Edit habit", icon: "pencil", onClick: () => habitModal(habit) },
          { label: "View history", icon: "analytics", onClick: () => navigate("analytics") },
          { type: "sep" },
          {
            label: "Delete", icon: "trash", danger: true, onClick: async () => {
              const ok = await confirmDialog({ title: "Delete habit?", message: `“${habit.name}” and its history will be removed.`, confirmLabel: "Delete", danger: true });
              if (ok) { deleteHabit(habitId); toast({ title: "Habit deleted", type: "info" }); if (typeof rerender === "function") rerender(); }
            }
          }
        ]);
        break;
      }
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "habits",
  title: "Habits",
  icon: "repeat",
  group: "Grow",
  order: 0,
  nav: true,
  render,
  mount
}];

