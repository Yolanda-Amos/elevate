/* ==========================================================================
   Elevate — Focus: immersive focus stage, ambient sound, session logging
   ========================================================================== */
import { escapeHtml, formatDuration, $ } from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, toast, progressRing, modal } from "../ui.js";
import { startAmbient, stopAmbient, chime, unlockAudio } from "../audio.js";
import {
  getFocusPrefs, updateFocusPrefs, focusStats, getFocusSessions, getTask,
  logFocusSession, AMBIENT_SOUNDS, getTasks
} from "../store.js";

const MODES = [
  { value: "pomodoro", label: "Pomodoro" },
  { value: "shortBreak", label: "Short break" },
  { value: "longBreak", label: "Long break" },
  { value: "custom", label: "Custom" }
];
const MODE_LABEL = {
  pomodoro: "Pomodoro", shortBreak: "Short break", longBreak: "Long break", custom: "Custom"
};

const durationFor = (mode) => Number((getFocusPrefs().durations || {})[mode]) || 25;

/* ------------------------------------------------------------- Fragments */
const pageHead = ({ eyebrow, title, sub, actions = "" }) => `
  <header class="page-head">
    <div class="page-head__main">
      <div class="page-head__eyebrow">${escapeHtml(eyebrow)}</div>
      <h1>${escapeHtml(title)}</h1>
      ${sub ? `<p class="page-head__sub">${escapeHtml(sub)}</p>` : ""}
    </div>
    <div class="page-head__actions">${actions}</div>
  </header>`;

function statsCards() {
  const stats = focusStats(7);
  const today = focusStats(1);
  const recent = getFocusSessions().slice(0, 40);
  const completion = recent.length ? recent.filter((s) => s.completed).length / recent.length : 1;
  const card = (label, value, foot, tone = "") => `
    <div class="stat">
      <div class="stat__top">
        <span class="stat__icon${tone ? ` stat__icon--${tone}` : ""}">${icon("timer", 15)}</span>
        <span class="stat__label">${escapeHtml(label)}</span>
      </div>
      <div class="stat__value">${value}</div>
      <div class="stat__foot">${foot}</div>
    </div>`;
  return `
    <section class="stat-grid">
      ${card("Focused today", formatDuration(today.totalMinutes, { short: true }), `${today.sessions} session${today.sessions === 1 ? "" : "s"}`, "success")}
      ${card("Last 7 days", formatDuration(stats.totalMinutes, { short: true }), `${stats.sessions} sessions`, "info")}
      ${card("Avg session", stats.average ? formatDuration(stats.average, { short: true }) : "—", `longest ${formatDuration(stats.longest, { short: true })}`)}
      ${card("Completion", `${Math.round(completion * 100)}%`, "sessions finished", "warning")}
    </section>`;
}

const soundGrid = () => {
  const prefs = getFocusPrefs();
  return `<div class="focus-sounds">${AMBIENT_SOUNDS.map((sound) => `
    <button class="sound-card${prefs.sound === sound.id ? " is-active" : ""}" type="button" data-act="sound" data-sound="${sound.id}">
      ${icon(sound.icon, 16)} <span class="grow" style="text-align:left">${escapeHtml(sound.name)}</span>
      ${prefs.sound === sound.id ? icon("check", 14) : ""}
    </button>`).join("")}</div>`;
};

function sessionList() {
  const sessions = getFocusSessions().slice(0, 8);
  if (!sessions.length) return emptyState({ icon: "timer", title: "No sessions yet", text: "Start your first focus block.", small: true, muted: true });
  return sessions.map((session) => `
    <div class="activity-item">
      <span class="activity-item__dot" style="background:${String(session.mode).includes("break") ? "var(--info)" : "var(--accent)"}"></span>
      <div class="grow">
        <div class="strong fs-xs">${escapeHtml(session.label || MODE_LABEL[session.mode] || "Focus")}</div>
        <div class="fs-2xs text-3">${new Date(session.startedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${formatDuration(session.minutes, { short: true })}${session.completed ? "" : " · left early"}</div>
      </div>
    </div>`).join("");
}

export function render() {
  const prefs = getFocusPrefs();
  const mode = prefs.mode || "pomodoro";
  const task = prefs.taskId ? getTask(prefs.taskId) : null;
  const stats = focusStats(7);
  const pct = Math.min(100, Math.round((stats.totalMinutes / (7 * 120)) * 100));
  return `
    <div class="col gap-5">
      ${pageHead({
    eyebrow: "Focus", title: "Deep focus", sub: "Protect blocks of time for your most important work.",
    actions: `<button class="btn btn--primary" type="button" data-act="start">${icon("play", 15)} Enter focus mode</button>`
  })}
      ${statsCards()}
      <div class="dash-grid">
        <div class="dash-col">
          <section class="card card--pad">
            <h3 class="card-title mb-3">Timer preset</h3>
            <div class="focus-modes" style="justify-content:flex-start">
              ${MODES.map((item) => `
                <button class="chip${mode === item.value ? " is-done" : ""}" type="button" data-act="mode" data-mode="${item.value}"
                  style="${mode === item.value ? "background:var(--accent);border-color:var(--accent);color:var(--accent-on)" : ""}">
                  ${escapeHtml(item.label)} · ${durationFor(item.value)}m
                </button>`).join("")}
            </div>
            <p class="fs-xs text-3 mt-4">Current: <strong>${escapeHtml(MODE_LABEL[mode] || mode)}</strong> — ${durationFor(mode)} minutes${task ? ` · attached to “${escapeHtml(task.title)}”` : ""}.</p>
            <div class="row gap-2 mt-4">
              <button class="btn btn--primary" type="button" data-act="start">${icon("play", 15)} Start session</button>
              ${task ? `<button class="btn btn--ghost" type="button" data-act="detach">${icon("x", 14)} Detach task</button>` : `<button class="btn btn--ghost" type="button" data-act="pick-task">${icon("tasks", 14)} Pick a task</button>`}
            </div>
          </section>
          <section class="card card--pad">
            <h3 class="card-title mb-3">Ambient sound</h3>
            ${soundGrid()}
            <p class="lock-note mt-3">${icon("info", 13)} Audio starts when a session starts. Change it any time.</p>
          </section>
        </div>
        <div class="dash-col">
          <section class="card card--pad">
            <div class="row-between mb-3">
              <h3 class="card-title">This week</h3>
              <span class="fs-xs text-3">${stats.sessions} sessions</span>
            </div>
            <div class="col center gap-2 mb-4">
              ${progressRing(pct, { size: 108, stroke: 9, label: formatDuration(stats.totalMinutes, { short: true }) })}
              <span class="fs-xs text-3">of a 2h/day deep-work target</span>
            </div>
            ${sessionList()}
          </section>
          <section class="card card--pad">
            <h3 class="card-title mb-2">Pomodoro rhythm</h3>
            <p class="fs-xs text-2">Work ${durationFor("pomodoro")} min → short break ${durationFor("shortBreak")} min → repeat. After four rounds take a ${durationFor("longBreak")} min break. Elevate tracks every round automatically.</p>
            <button class="btn btn--soft btn--sm mt-3" type="button" data-act="start">${icon("play", 14)} Begin round one</button>
          </section>
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------- Focus stage UI */
let stage = null;
let onStageEnd = null;

const fmtClock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function stageMarkup(mode, totalSeconds, taskId) {
  const task = taskId ? getTask(taskId) : null;
  const prefs = getFocusPrefs();
  const sound = AMBIENT_SOUNDS.find((item) => item.id === prefs.sound) || AMBIENT_SOUNDS[0];
  return `
    <div class="focus-stage" id="focus-stage" role="dialog" aria-label="Focus mode">
      <div class="focus-stage__top">
        <span class="badge badge--accent">${icon("timer", 11)} Focus mode</span>
        <span class="grow"></span>
        <button class="btn btn--ghost btn--sm" type="button" data-act="stage-end">${icon("stop", 14)} End session</button>
        <button class="icon-btn" type="button" data-act="stage-close" aria-label="Close focus mode">${icon("x", 18)}</button>
      </div>
      <div class="focus-stage__center">
        <div class="focus-modes">
          ${MODES.map((item) => `
            <button class="chip" type="button" data-act="stage-mode" data-mode="${item.value}"
              style="${item.value === mode ? "background:var(--accent);border-color:var(--accent);color:var(--accent-on);font-weight:600" : ""}">
              ${escapeHtml(item.label)}
            </button>`).join("")}
        </div>
        <div class="focus-timer" data-timer>${fmtClock(totalSeconds)}</div>
        <div class="focus-task">${task ? escapeHtml(task.title) : "No task attached — just breathe and work."}</div>
        <div class="focus-controls">
          <button class="btn btn--lg" type="button" data-act="stage-reset">${icon("refresh", 16)} Reset</button>
          <button class="btn btn--primary btn--xl" type="button" data-act="stage-toggle">${icon("play", 18)} <span data-toggle-label>Start</span></button>
          <button class="btn btn--lg" type="button" data-act="stage-skip">${icon("skip", 16)} Skip</button>
        </div>
        <div class="focus-dots">${Array.from({ length: 4 }, (_, index) => `<span class="focus-dot" data-round="${index}"></span>`).join("")}</div>
        <p class="fs-xs text-3">Sound: ${escapeHtml(sound.name)} · ${durationFor(mode)} minute ${escapeHtml((MODE_LABEL[mode] || mode).toLowerCase())}</p>
        <div class="focus-sounds" style="max-width:640px;width:100%">
          ${AMBIENT_SOUNDS.map((item) => `
            <button class="sound-card${prefs.sound === item.id ? " is-active" : ""}" type="button" data-act="stage-sound" data-sound="${item.id}">
              ${icon(item.icon, 15)} <span class="grow" style="text-align:left">${escapeHtml(item.name)}</span>
            </button>`).join("")}
        </div>
      </div>
    </div>`;
}

function clearStage() {
  if (!stage) return;
  clearInterval(stage.tick);
  stopAmbient();
  stage.node.remove();
  stage = null;
}

const sessionMode = (mode) =>
  mode === "shortBreak" ? "short-break" : mode === "longBreak" ? "long-break" : mode;

function logSession(completed) {
  const elapsed = Math.max(1, Math.round((stage.total - stage.remaining) / 60));
  const task = stage.taskId ? getTask(stage.taskId) : null;
  logFocusSession({
    taskId: stage.taskId,
    minutes: completed ? Math.round(stage.total / 60) : elapsed,
    mode: sessionMode(stage.mode),
    label: task ? task.title : (MODE_LABEL[stage.mode] || "Focus"),
    completed
  });
}

/** Opens (or re-opens) the immersive focus stage. */
export function openFocusStage({ taskId = null, onEnd = null } = {}) {
  unlockAudio();
  clearStage();
  if (typeof onEnd === "function") onStageEnd = onEnd;
  const prefs = getFocusPrefs();
  const mode = taskId ? "pomodoro" : (prefs.mode || "pomodoro");
  const total = durationFor(mode) * 60;

  const host = document.createElement("div");
  host.innerHTML = stageMarkup(mode, total, taskId);
  const root = host.firstElementChild;
  document.body.appendChild(root);

  stage = { node: root, mode, taskId, total, remaining: total, running: false, tick: null };

  const paint = () => {
    const timer = $("[data-timer]", root);
    if (timer) timer.textContent = fmtClock(stage.remaining);
    document.title = stage.running
      ? `${fmtClock(stage.remaining)} · Elevate Focus`
      : "Elevate — Calm, intelligent productivity";
  };
  const setToggle = (label) => {
    const target = $("[data-toggle-label]", root);
    if (target) target.textContent = label;
  };
  const stop = () => {
    clearInterval(stage.tick);
    stage.running = false;
    stopAmbient();
  };

  const start = () => {
    if (stage.running) return;
    stage.running = true;
    setToggle("Pause");
    startAmbient(getFocusPrefs().sound, getFocusPrefs().soundVolume);
    stage.tick = setInterval(() => {
      stage.remaining -= 1;
      if (stage.remaining <= 0) {
        stage.remaining = 0;
        paint();
        close(true);
        return;
      }
      paint();
    }, 1000);
    paint();
  };

  const pause = () => {
    stop();
    setToggle("Resume");
    paint();
  };

  const close = (completed, { silent = false } = {}) => {
    const wasBreak = stage && String(sessionMode(stage.mode)).includes("break");
    if (stage && (stage.total - stage.remaining) > 15) logSession(completed);
    stop();
    clearStage();
    document.title = "Elevate — Calm, intelligent productivity";
    if (!silent) {
      chime({ type: "complete" });
      toast({
        title: completed ? "Session complete" : "Session logged",
        desc: completed && !wasBreak ? "Take a break — you earned it." : "Nice work showing up.",
        type: "success"
      });
    }
    if (typeof onStageEnd === "function") { const done = onStageEnd; onStageEnd = null; done(); }
  };

  const setMode = (nextMode) => {
    stop();
    stage.mode = nextMode;
    stage.total = durationFor(nextMode) * 60;
    stage.remaining = stage.total;
    updateFocusPrefs({ mode: nextMode });
    root.querySelectorAll("[data-act='stage-mode']").forEach((chip) => {
      chip.style.cssText = chip.dataset.mode === nextMode
        ? "background:var(--accent);border-color:var(--accent);color:var(--accent-on);font-weight:600"
        : "";
    });
    setToggle("Start");
    paint();
  };

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "stage-toggle": stage.running ? pause() : start(); break;
      case "stage-reset": stop(); stage.remaining = stage.total; setToggle("Start"); paint(); break;
      case "stage-skip": close(stage.remaining === 0, { silent: true }); break;
      case "stage-end": close(stage.remaining === 0); break;
      case "stage-close": close(stage.remaining === 0, { silent: (stage.total - stage.remaining) <= 15 }); break;
      case "stage-mode": setMode(action.dataset.mode); break;
      case "stage-sound":
        updateFocusPrefs({ sound: action.dataset.sound });
        root.querySelectorAll(".focus-sounds .sound-card").forEach((card) =>
          card.classList.toggle("is-active", card.dataset.sound === action.dataset.sound));
        if (stage.running) startAmbient(action.dataset.sound, getFocusPrefs().soundVolume);
        break;
      default: break;
    }
  });

  paint();
  setTimeout(() => start(), 250);
}

/* --FOCUS-END-- */

/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  onStageEnd = () => { if (typeof rerender === "function") rerender(); };

  const pickTask = () => {
    const open = getTasks().filter((task) => task.status !== "done").slice(0, 40);
    if (!open.length) { toast({ title: "No open tasks", type: "info" }); return; }
    modal({
      title: "Attach a task",
      subtitle: "The timer keeps context while you work.",
      body: `<div class="col gap-2" style="max-height:52vh;overflow:auto">
        ${open.map((task) => `
          <button class="row-item" type="button" data-pick="${task.id}" style="padding:9px 10px">
            <span class="row-item__body"><span class="row-item__title truncate">${escapeHtml(task.title)}</span></span>
          </button>`).join("")}
      </div>`,
      size: "sm",
      onMount: (node, entry) => {
        node.addEventListener("click", (event) => {
          const pick = event.target.closest("[data-pick]");
          if (!pick) return;
          updateFocusPrefs({ taskId: pick.dataset.pick });
          entry.close();
          toast({ title: "Task attached", type: "success", duration: 1500 });
          if (typeof rerender === "function") rerender();
        });
      }
    });
  };

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "start":
        openFocusStage({ taskId: getFocusPrefs().taskId || null, onEnd: rerender });
        break;
      case "mode":
        updateFocusPrefs({ mode: action.dataset.mode });
        if (typeof rerender === "function") rerender();
        break;
      case "sound":
        updateFocusPrefs({ sound: action.dataset.sound });
        startAmbient(action.dataset.sound, getFocusPrefs().soundVolume);
        if (typeof rerender === "function") rerender();
        break;
      case "pick-task":
        pickTask();
        break;
      case "detach":
        updateFocusPrefs({ taskId: null });
        if (typeof rerender === "function") rerender();
        break;
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "focus",
  title: "Focus",
  icon: "timer",
  group: "Focus",
  order: 0,
  nav: true,
  render,
  mount
}];
