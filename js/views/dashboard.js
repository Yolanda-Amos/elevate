/* ==========================================================================
   Elevate — Dashboard: greeting, score, My Day, schedule, deadlines, week
   ========================================================================== */
import {
  $, escapeHtml, todayISO, formatTime, formatDuration, greeting, greetingEmoji, formatDate,
  nowHHMM, toMinutes, motivation
} from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, progressRing, toast, confirmDialog } from "../ui.js";
import { barChart } from "../charts.js";
import {
  todayOverview, weeklySummary, myDayTasks, todayTasks, upcomingTasks, getEventsForDate,
  getProject, tasksWithBlocks, tasksDueOn, focusStats, getUi, updateUi,
  hasSampleData, setSampleData, getTasks
} from "../store.js";
import { taskRow, bindTaskList } from "../taskrows.js";
import { openQuickAdd } from "../taskform.js";
import { navigate } from "../router.js";
import { openFocusStage } from "./focus.js";

/* Chosen once per page load — the greeting changes every time you reopen. */
const MOTTO = motivation();

const statCard = ({ icon: iconName, tone = "", label, value, foot }) => `
  <div class="stat">
    <div class="stat__top">
      <span class="stat__icon${tone ? ` stat__icon--${tone}` : ""}">${icon(iconName, 15)}</span>
      <span class="stat__label">${escapeHtml(label)}</span>
    </div>
    <div class="stat__value">${value}</div>
    ${foot ? `<div class="stat__foot">${foot}</div>` : ""}
  </div>`;

function heroNote(overview) {
  if (overview.overdue > 0) return `${overview.overdue} overdue ${overview.overdue === 1 ? "task" : "tasks"} — knock those out first and your score jumps.`;
  if (overview.dueToday > 0 && overview.doneToday === overview.dueToday) return "Everything due today is already done. Protect the rest of the day for deep work.";
  if (overview.focusMinutes >= 90) return `${formatDuration(overview.focusMinutes, { short: true })} of focus logged already. That is a strong rhythm.`;
  const myDay = overview.myDay;
  if (myDay > 0) return `You have ${myDay} ${myDay === 1 ? "task" : "tasks"} in My Day. Start with the hardest one.`;
  return "Nothing urgent yet. Pick your top three and the day will organise itself.";
}

/** Combines timed events, time-blocked tasks and due tasks into one timeline. */
function buildSchedule() {
  const date = todayISO();
  const items = [];

  getEventsForDate(date).forEach((event) => {
    items.push({
      id: event.id, kind: "event", title: event.title, start: event.start, end: event.end,
      meta: [event.location, (event.attendees || []).length ? `${event.attendees.length} attendees` : ""].filter(Boolean)
    });
  });

  tasksWithBlocks(date).forEach((task) => {
    items.push({
      id: task.id, kind: "block", title: task.title, start: task.timeBlock.start, end: task.timeBlock.end,
      done: task.status === "done", meta: ["Time block", getProject(task.projectId) ? getProject(task.projectId).name : ""].filter(Boolean)
    });
  });

  tasksDueOn(date, { includeDone: true }).filter((task) => task.dueTime && !task.timeBlock).forEach((task) => {
    items.push({
      id: task.id, kind: "task", title: task.title, start: task.dueTime,
      end: null, done: task.status === "done", meta: ["Due", task.estimatedMinutes ? formatDuration(task.estimatedMinutes, { short: true }) : ""].filter(Boolean)
    });
  });

  return items.sort((a, b) => toMinutes(a.start || "23:59") - toMinutes(b.start || "23:59")).slice(0, 8);
}

const scheduleRow = (item) => {
  const now = toMinutes(nowHHMM());
  const start = toMinutes(item.start || "23:59");
  const end = item.end ? toMinutes(item.end) : null;
  const isNow = start <= now && (end ? end >= now : start + 30 >= now);
  return `
    <div class="sched__row${isNow ? " sched__row--now" : ""}">
      <div class="sched__time">${escapeHtml(item.start ? formatTime(item.start, { compact: true }) : "")}</div>
      <div class="sched__rail">
        <span class="sched__dot${item.done ? " sched__dot--done" : item.kind === "event" ? " sched__dot--event" : " sched__dot--accent"}"></span>
      </div>
      <div class="sched__body">
        <div class="sched__title${item.done ? " text-3" : ""}" ${item.done ? 'style="text-decoration:line-through"' : ""}>${escapeHtml(item.title)}</div>
        <div class="sched__meta">
          ${item.end ? `<span>${escapeHtml(formatTime(item.start, { compact: true }))} – ${escapeHtml(formatTime(item.end, { compact: true }))}</span>` : ""}
          ${item.meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}
        </div>
      </div>
    </div>`;
};

/* A one-time nudge explaining the focus timer. Dismissals persist. */
const FOCUS_NOTICE = "focus-notice";

const focusNotice = () => {
  const ui = getUi();
  if ((ui.dismissedHints || []).includes(FOCUS_NOTICE)) return "";
  return `
    <section class="focus-notice">
      <span class="focus-notice__icon">${icon("timer", 18)}</span>
      <div class="grow">
        <div class="strong fs-sm">Protect your attention with Focus mode</div>
        <div class="fs-xs text-2">Pick any task, start a 25-minute block, and Elevate keeps the timer running while ambient sound drowns out distractions. Every finished session is logged for you.</div>
        <div class="row gap-2 mt-3">
          <button class="btn btn--soft btn--sm" type="button" data-act="start-focus">${icon("play", 13)} Start a session</button>
          <button class="btn btn--ghost btn--sm" type="button" data-act="dismiss-focus-notice">Got it</button>
        </div>
      </div>
      <button class="icon-btn" type="button" data-act="dismiss-focus-notice" aria-label="Dismiss">${icon("x", 15)}</button>
    </section>`;
};

/* A single dense row of numbers so the day is scannable without scrolling. */
const statStrip = (items) => `
  <section class="stat-strip" aria-label="Today at a glance">
    ${items.map((item) => `
      <div class="stat-chip${item.tone ? ` stat-chip--${item.tone}` : ""}">
        <span class="stat-chip__icon">${icon(item.icon, 14)}</span>
        <div class="stat-chip__body">
          <span class="stat-chip__label">${escapeHtml(item.label)}</span>
          <span class="stat-chip__value">${item.value}</span>
        </div>
      </div>`).join("")}
  </section>`;

/* ------------------------------------------------------------------ Render */
export function render() {
  const overview = todayOverview();
  const week = weeklySummary();
  const myDay = myDayTasks();
  const today = todayTasks({ includeDone: true });
  const schedule = buildSchedule();
  const focus = focusStats(7);
  const upcoming = upcomingTasks(7).slice(0, 5);
  const sampleOn = hasSampleData();
  /* Nothing of the user's own and no demo loaded — the one moment worth
     offering the sample workspace, without nagging once real work exists. */
  const workspaceEmpty = !sampleOn && getTasks().length === 0;

  return `
    <div class="dash">
      <section class="hero">
        <div class="hero__row">
          <div class="grow">
            <h1 class="hero__greet">${escapeHtml(greeting())}, ${escapeHtml(MOTTO)} ${greetingEmoji()}</h1>
            <p class="hero__date">${escapeHtml(formatDate(todayISO(), "long"))} · ${today.length} ${today.length === 1 ? "task" : "tasks"} due today</p>
            <div class="row gap-2 mt-4 wrap">
              <button class="btn btn--primary" type="button" data-act="quick-add">${icon("plus", 15)} Quick add</button>
              <button class="btn btn--ghost" type="button" data-act="start-focus">${icon("play", 15)} Start focus</button>
            </div>
          </div>
          <div class="hero__side">
            <div class="col center gap-2">
              ${progressRing(overview.score, { size: 96, stroke: 8, label: String(overview.score) })}
              <span class="fs-xs text-3">Productivity score</span>
            </div>
            <div class="hero__streak">
              <span class="stat__icon stat__icon--warning">${icon("flame", 16)}</span>
              <div>
                <div class="hero__streak-value">${overview.streak}<span class="fs-sm text-3">d</span></div>
                <span class="fs-xs text-3">Streak · best ${overview.bestStreak}d</span>
              </div>
            </div>
            <div class="hero__sample">
              <div class="hero__sample-text">
                <span class="hero__sample-title">Sample data</span>
                <span class="hero__sample-desc">${sampleOn ? "Demo workspace loaded" : "Your workspace is empty"}</span>
              </div>
              <button class="switch${sampleOn ? " is-on" : ""}" type="button" role="switch"
                aria-checked="${String(sampleOn)}" data-act="sample-data" aria-label="Sample data"></button>
            </div>
          </div>
        </div>
      </section>

      ${statStrip([
    { icon: "check-circle", tone: "success", label: "Completed", value: overview.completedToday },
    { icon: "tasks", label: "Due today", value: `${overview.doneToday}/${overview.dueToday}` },
    { icon: "alert", tone: overview.overdue ? "danger" : "success", label: "Overdue", value: overview.overdue },
    { icon: "timer", tone: "info", label: "Focus", value: formatDuration(overview.focusMinutes, { short: true }) },
    { icon: "inbox", label: "Inbox", value: overview.inbox },
      { icon: "flame", tone: "warning", label: "Streak", value: `${overview.streak}d` }
  ])}

      ${focusNotice()}

      <div class="dash-grid dash-grid--even">
        <div class="dash-col">
          <section class="card card--flush">
            <div class="card__head">
              <span class="stat__icon">${icon("sun", 15)}</span>
              <div>
                <h3>My Day</h3>
                <div class="card-sub">${myDay.length ? `${myDay.length} ${myDay.length === 1 ? "task" : "tasks"} you committed to` : "Nothing committed yet"}</div>
              </div>
              <div class="card__head-actions">
                <button class="btn btn--ghost btn--sm" type="button" data-act="quick-add-myday">${icon("plus", 14)} Add</button>
                <button class="btn btn--ghost btn--sm" type="button" data-act="go-today">Today ${icon("chevron-right", 14)}</button>
              </div>
            </div>
            ${myDay.length
    ? `<div class="list dash-list--scroll">${myDay.map((task) => taskRow(task, { showProject: true })).join("")}</div>`
    : emptyState({
      icon: "sun",
      title: "Your day is open",
      text: "Add the two or three things that would make today feel like a win.",
      actions: `<button class="btn btn--primary btn--sm" type="button" data-act="quick-add-myday">${icon("plus", 14)} Add a task</button>${workspaceEmpty
        ? `<button class="btn btn--ghost btn--sm" type="button" data-act="sample-data">${icon("sparkles", 14)} Load sample data</button>`
        : ""}`,
      small: true
    })}
          </section>
        </div>

        <div class="dash-col">
          <section class="card card--flush">
            <div class="card__head">
              <span class="stat__icon stat__icon--info">${icon("calendar-clock", 15)}</span>
              <div>
                <h3>Today's schedule</h3>
                <div class="card-sub">${schedule.length ? `Next up: ${escapeHtml(schedule[0].title)}` : "Nothing scheduled"}</div>
              </div>
              <div class="card__head-actions">
                <button class="btn btn--ghost btn--sm" type="button" data-act="go-calendar">Calendar ${icon("chevron-right", 14)}</button>
              </div>
            </div>
            ${schedule.length
    ? `<div style="padding:var(--s-4) var(--s-5)"><div class="sched">${schedule.map(scheduleRow).join("")}</div></div>`
    : emptyState({
      icon: "calendar",
      title: "A clear runway",
      text: "Time-block two focus sessions and the day tends to hold together.",
      actions: `<button class="btn btn--sm" type="button" data-act="go-calendar">${icon("calendar", 14)} Open calendar</button>`,
      small: true
    })}
          </section>
        </div>
      </div>

      <section class="card card--flush">
        <div class="card__head">
          <span class="stat__icon stat__icon--danger">${icon("alert", 15)}</span>
          <div>
            <h3>Upcoming deadlines</h3>
            <div class="card-sub">The next seven days</div>
          </div>
          <div class="card__head-actions">
            <button class="btn btn--ghost btn--sm" type="button" data-act="go-upcoming">All ${icon("chevron-right", 14)}</button>
          </div>
        </div>
        ${upcoming.length
    ? `<div class="list dash-list--scroll">${upcoming.map((task) => taskRow(task, { dense: true })).join("")}</div>`
    : emptyState({ icon: "check-circle", title: "Nothing pressing", text: "No deadlines in the next week.", small: true, muted: true })}
      </section>

      <section class="card card--pad">
        <div class="row-between mb-4">
          <div>
            <h3 class="card-title">Weekly summary</h3>
            <div class="card-sub">${week.completed} completed · ${formatDuration(week.focus, { short: true })} focused</div>
          </div>
          ${week.delta !== null ? `<span class="metric__delta metric__delta--${week.delta >= 0 ? "up" : "flat"}">${week.delta >= 0 ? "+" : ""}${week.delta}%</span>` : ""}
        </div>
        ${barChart(week.days.map((day) => ({ label: day.label, value: day.completed })), { height: 132 })}
        <div class="weekbars mt-4">
          ${week.days.map((day) => {
    const peak = Math.max(...week.days.map((d) => d.completed), 1);
    return `
                <div class="weekbars__row${day.date === todayISO() ? " is-today" : ""}">
                  <span>${escapeHtml(day.label)}</span>
                  <span class="weekbars__track"><span class="weekbars__fill" style="width:${Math.min(100, (day.completed / peak) * 100)}%"></span></span>
                  <span class="tnum">${day.completed}</span>
                </div>`;
  }).join("")}
        </div>
      </section>
    </div>`;
}

/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  bindTaskList(root, {
    onFocusTask: (taskId) => openFocusStage({ taskId }),
    onChanged: rerender
  });

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "quick-add":
        openQuickAdd({ onSaved: rerender });
        break;
      case "quick-add-myday":
        openQuickAdd({ defaults: { myDay: true, dueDate: todayISO() }, onSaved: rerender });
        break;
      case "start-focus":
        openFocusStage({});
        break;
      case "dismiss-focus-notice": {
        const ui = getUi();
        updateUi({ dismissedHints: [...(ui.dismissedHints || []), FOCUS_NOTICE] });
        if (typeof rerender === "function") rerender();
        break;
      }
      case "sample-data": {
        const turningOn = !hasSampleData();
        const run = () => {
          setSampleData(turningOn);
          toast(turningOn
            ? { title: "Sample data loaded", desc: "A demo workspace to explore — switch it off any time.", type: "success" }
            : { title: "Sample data cleared", desc: "Your workspace is empty again.", type: "info" });
          if (typeof rerender === "function") rerender();
        };
        /* Clearing deletes real records, so it always asks first. */
        if (turningOn) run();
        else {
          confirmDialog({
            title: "Clear all sample data?",
            message: "Every task, project, note, habit, goal and event will be deleted. This cannot be undone.",
            confirmLabel: "Clear everything",
            danger: true
          }).then((ok) => { if (ok) run(); });
        }
        break;
      }
      case "go-today":
        navigate("today");
        break;
      case "go-calendar":
        navigate("calendar");
        break;
      case "go-upcoming":
        navigate("upcoming");
        break;
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "dashboard",
  title: "Dashboard",
  icon: "home",
  group: "Plan",
  order: 0,
  nav: true,
  render,
  mount
}];


