/* ==========================================================================
   Elevate — Analytics: trends, breakdowns, heatmap and insights
   ========================================================================== */
import { escapeHtml, formatDuration, lastNDays, $ } from "../utils.js";
import { icon, PRIORITY_META } from "../icons.js";
import { emptyState, progressRing } from "../ui.js";
import { barChart, lineChart, donutChart, heatmap, hBars } from "../charts.js";
import {
  dailySeries, productivityScore, focusStats, priorityBreakdown, workloadByProject,
  tagBreakdown, insights, productiveStreak, completedOn, todayOverview, weeklySummary,
  scoreTone, habitsCompletedOn, habitsScheduledOn
} from "../store.js";

let rangeDays = 14;

const card = (title, sub, body, actions = "") => `
  <section class="card card--pad">
    <div class="row-between mb-4">
      <div>
        <h3 class="card-title">${escapeHtml(title)}</h3>
        ${sub ? `<div class="card-sub">${escapeHtml(sub)}</div>` : ""}
      </div>
      ${actions}
    </div>
    ${body}
  </section>`;

function metricsRow() {
  const overview = todayOverview();
  const week = weeklySummary();
  const streak = productiveStreak();
  const focus = focusStats(rangeDays);
  const scheduled = lastNDays(rangeDays).reduce((sum, date) => sum + habitsScheduledOn(date), 0);
  const done = lastNDays(rangeDays).reduce((sum, date) => sum + habitsCompletedOn(date), 0);
  const habitRate = scheduled ? Math.round((done / scheduled) * 100) : 0;
  const metric = (label, value, delta) => `
    <div class="metric">
      <span class="metric__value">${value}</span>
      <span class="metric__label">${escapeHtml(label)}</span>
      ${delta}
    </div>`;
  return `
    <section class="stat-grid">
      <div class="stat">
        <div class="stat__top"><span class="stat__icon">${icon("sparkles", 15)}</span><span class="stat__label">Productivity score</span></div>
        <div class="row gap-3" style="align-items:center">
          ${progressRing(overview.score, { size: 58, stroke: 6, label: String(overview.score), tone: scoreTone(overview.score) })}
          <div class="stat__foot">Updated live from completions, deadlines, focus and habits.</div>
        </div>
      </div>
      ${metric("Completed (7d)", week.completed, week.delta !== null ? `<span class="metric__delta metric__delta--${week.delta >= 0 ? "up" : "flat"}">${week.delta >= 0 ? "+" : ""}${week.delta}% vs prior week</span>` : "")}
      ${metric(`Focus (${rangeDays}d)`, formatDuration(focus.totalMinutes, { short: true }), `<span class="metric__label">${focus.sessions} sessions · ${focus.average}m avg</span>`)}
      ${metric("Habit completion", `${habitRate}%`, `<span class="metric__label">${done}/${scheduled} check-ins</span>`)}
      ${metric("Productive streak", `${streak.current}d`, `<span class="metric__label">best ${streak.best}d</span>`)}
    </section>`;
}

function scoreTrend() {
  const series = dailySeries(rangeDays);
  const data = series.map((day) => ({ label: day.label, value: productivityScore(day.date) }));
  return lineChart(data, { height: 176, suffix: "" });
}

function completionBars() {
  const series = dailySeries(rangeDays);
  return barChart(series.map((day) => ({ label: day.label, value: day.completed })), { height: 160 });
}

function focusBars() {
  const stats = focusStats(rangeDays);
  return barChart(stats.byDate.map((day) => ({ label: day.label, value: day.minutes })), { height: 150, suffix: "m" });
}

function priorityDonut() {
  const rows = priorityBreakdown().filter((row) => row.count > 0);
  if (!rows.length) return emptyState({ icon: "flag", title: "No open tasks", text: "Nothing to prioritise.", small: true, muted: true });
  return donutChart(
    rows.map((row) => ({ label: PRIORITY_META[row.priority].label, value: row.count, color: PRIORITY_META[row.priority].color })),
    { size: 150, centerLabel: String(rows.reduce((sum, row) => sum + row.count, 0)), centerSub: "open" }
  );
}

function projectBars() {
  const rows = workloadByProject().filter((row) => row.total > 0).slice(0, 7);
  if (!rows.length) return emptyState({ icon: "folder", title: "No projects yet", text: "Create a project to see workload.", small: true, muted: true });
  return hBars(rows.map((row) => ({
    label: row.project.name,
    value: row.open,
    color: row.project.color,
    meta: `${row.done} done · ${row.overdue} overdue`
  })));
}

function activityHeat() {
  const days = lastNDays(84);
  const values = {};
  days.forEach((date) => { values[date] = completedOn(date); });
  return heatmap(values, days, { max: 6, tooltipPrefix: "completed" });
}

function insightList() {
  const items = insights();
  if (!items.length) return `<p class="fs-xs text-3">Keep working — patterns appear after a few days.</p>`;
  return items.map((item) => `
    <div class="insight">
      <span class="insight__icon" style="color:${item.tone}">${icon(item.icon, 14)}</span>
      <div>
        <div class="strong fs-sm">${escapeHtml(item.title)}</div>
        <div class="fs-xs text-2">${escapeHtml(item.text)}</div>
      </div>
    </div>`).join("");
}

export function render() {
  const series = dailySeries(rangeDays);
  const totalCompleted = series.reduce((sum, day) => sum + day.completed, 0);
  const tagRows = tagBreakdown();
  const RANGES = [7, 14, 30];

  return `
    <div class="col gap-5">
      <header class="page-head">
        <div class="page-head__main">
          <div class="page-head__eyebrow">Insights</div>
          <h1>Analytics</h1>
          <p class="page-head__sub">How your time, attention and habits are actually trending.</p>
        </div>
        <div class="page-head__actions">
          <div class="segmented">
            ${RANGES.map((days) => `
              <button class="segmented__item${rangeDays === days ? " is-active" : ""}" type="button" data-act="range" data-days="${days}">${days}d</button>`).join("")}
          </div>
        </div>
      </header>

      ${metricsRow()}

      <div class="chart-grid">
        ${card("Productivity trend", `Daily 0–100 score over ${rangeDays} days`, scoreTrend())}
        ${card("Tasks completed", `${totalCompleted} completed in the last ${rangeDays} days`, completionBars())}
        ${card("Deep work", "Focus minutes per day", focusBars())}
        ${card("Open tasks by priority", "Where the pressure sits right now", priorityDonut())}
        ${card("Workload by project", "Open tasks per project", projectBars())}
        ${card("Consistency heatmap", "Completions over the last 12 weeks", activityHeat())}
      </div>

      <div class="dash-grid">
        <section class="card card--pad">
          <h3 class="card-title mb-2">What Elevate noticed</h3>
          ${insightList()}
        </section>
        <section class="card card--pad">
          <h3 class="card-title mb-3">Open tasks by tag</h3>
          ${tagRows.length
      ? `<div class="col gap-3">${tagRows.map((row) => {
        const pct = Math.min(100, row.count * 8);
        return `
              <div>
                <div class="row-between mb-2" style="gap:10px">
                  <span class="fs-xs strong"><span class="tag-dot" style="background:${row.tag.color}"></span> ${escapeHtml(row.tag.name)}</span>
                  <span class="fs-xs text-3 tnum">${row.count}</span>
                </div>
                <div class="progress progress--xs"><div class="progress__bar" style="width:${pct}%;background:${row.tag.color}"></div></div>
              </div>`;
      }).join("")}</div>`
      : emptyState({ icon: "tag", title: "No tagged tasks", text: "Tag tasks to see where time goes.", small: true, muted: true })}
        </section>
      </div>
    </div>`;
}

let pendingRerender = null;

export function mount(root, { rerender } = {}) {
  pendingRerender = rerender;
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action || action.dataset.act !== "range") return;
    rangeDays = Number(action.dataset.days) || 14;
    if (typeof rerender === "function") rerender();
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "analytics",
  title: "Analytics",
  icon: "analytics",
  group: "Insights",
  order: 0,
  nav: true,
  render,
  mount
}];

