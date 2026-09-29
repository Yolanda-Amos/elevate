/* ==========================================================================
   Elevate — Settings: appearance, preferences, notifications, data
   ========================================================================== */
import { escapeHtml, $, storageBytes, download, modKey } from "../utils.js";
import { icon } from "../icons.js";
import { toast, confirmDialog, fileSize } from "../ui.js";
import { navigate } from "../router.js";
import {
  getPreferences, updatePreferences, getNotifications, updateNotifications,
  updateQuietHours, getUi, updateUi, getFocusPrefs, updateFocusPrefs,
  exportState, importState, clearAllData, setSampleData,
  requestDesktopNotifications, notificationsSupported, getState,
  getTasks, getProjects, getNotes, getHabits
} from "../store.js";

const SECTIONS = [
  { key: "appearance", label: "Appearance", icon: "sparkles", desc: "Theme, accent colour and density." },
  { key: "preferences", label: "Preferences", icon: "settings", desc: "Planning defaults and work hours." },
  { key: "notifications", label: "Notifications", icon: "bell", desc: "Reminders, digests and quiet hours." },
  { key: "data", label: "Data & privacy", icon: "shield", desc: "Sample data, export, import and wipe." }
];

const THEMES = [
  { value: "light", label: "Light", bg: "#fbfbfc", panel: "#ffffff" },
  { value: "dark", label: "Dark", bg: "#0e0f13", panel: "#16181e" },
  { value: "system", label: "System", bg: "linear-gradient(90deg,#fbfbfc 50%,#0e0f13 50%)", panel: "linear-gradient(90deg,#fff 50%,#16181e 50%)" }
];
const ACCENTS = [
  { value: "violet", label: "Violet", hex: "#5b5bd6" },
  { value: "teal", label: "Teal", hex: "#0f8a83" },
  { value: "amber", label: "Amber", hex: "#c07409" },
  { value: "rose", label: "Rose", hex: "#c8437c" },
  { value: "blue", label: "Blue", hex: "#2f6fd0" },
  { value: "green", label: "Green", hex: "#159a63" }
];

const switchRow = (key, title, desc, on, group = "generic") => `
  <div class="switch-row">
    <div class="switch-row__text">
      <div class="switch-row__title">${escapeHtml(title)}</div>
      ${desc ? `<div class="switch-row__desc">${escapeHtml(desc)}</div>` : ""}
    </div>
    <button class="switch${on ? " is-on" : ""}" type="button" role="switch" aria-checked="${Boolean(on)}"
      data-switch="${key}" data-group="${group}" aria-label="${escapeHtml(title)}"></button>
  </div>`;

const sectionBlock = (title, desc, body) => `
  <section class="settings-block">
    <h3 class="settings-block__title">${escapeHtml(title)}</h3>
    ${desc ? `<p class="settings-block__desc">${escapeHtml(desc)}</p>` : ""}
    ${body}
  </section>`;

const field = (label, input) => `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    ${input}
  </label>`;

const selectRow = (label, act, options, value) => `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <select class="select" data-setting="${act}">
      ${options.map((option) => `<option value="${escapeHtml(String(option.value))}"${String(option.value) === String(value) ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
    </select>
  </label>`;

/* --------------------------------------------------------------- Sections */
function appearanceSection() {
  const ui = getUi();
  const prefs = getPreferences();
  return `
    ${sectionBlock("Theme", "Switch between light, dark and your system setting.", `
      <div class="theme-preview">
        ${THEMES.map((theme) => `
          <button class="theme-swatch${ui.theme === theme.value ? " is-active" : ""}" type="button" data-act="theme" data-theme="${theme.value}">
            <span class="theme-swatch__preview" style="background:${theme.bg}"></span>
            <span class="row gap-2"><span class="fs-sm">${theme.label}</span>${ui.theme === theme.value ? icon("check", 13) : ""}</span>
          </button>`).join("")}
      </div>`)}
    ${sectionBlock("Accent", "One colour, used sparingly, everywhere.", `
      <div class="accent-row">
        ${ACCENTS.map((accent) => `
          <button class="accent-dot${ui.accent === accent.value ? " is-active" : ""}" type="button" data-act="accent" data-accent="${accent.value}"
            style="background:${accent.hex};color:${accent.hex}" aria-label="${accent.label}" data-tip="${accent.label}"></button>`).join("")}
      </div>`)}
    ${sectionBlock("Density", "Comfortable keeps breathing room; compact fits more on screen.", `
      <div class="segmented segmented--block" style="max-width:340px">
        <button class="segmented__item${ui.density !== "compact" ? " is-active" : ""}" type="button" data-act="density" data-density="comfortable">Comfortable</button>
        <button class="segmented__item${ui.density === "compact" ? " is-active" : ""}" type="button" data-act="density" data-density="compact">Compact</button>
      </div>`)}
    ${sectionBlock("Motion", "Reduce animations if you prefer stillness.", switchRow("reduceMotion", "Reduce motion", "Calms transitions across the app.", Boolean(prefs.reduceMotion), "prefs"))}`;
}

function preferencesSection() {
  const prefs = getPreferences();
  const focus = getFocusPrefs();
  return `
    ${sectionBlock("Planning", "Defaults that shape calendars and task lists.", `
      <div class="detail__grid">
        ${selectRow("Week starts", "startOfWeek", [{ value: "1", label: "Monday" }, { value: "0", label: "Sunday" }, { value: "6", label: "Saturday" }], prefs.startOfWeek)}
        ${selectRow("Default task view", "defaultView", [{ value: "list", label: "List" }, { value: "board", label: "Board" }], prefs.defaultView)}
        ${selectRow("Default reminder", "defaultReminder", [{ value: "0", label: "At due time" }, { value: "10", label: "10 min before" }, { value: "15", label: "15 min before" }, { value: "60", label: "1 hour before" }], prefs.defaultReminder)}
        ${selectRow("Focus preset", "focusMode", [{ value: "pomodoro", label: "Pomodoro (25m)" }, { value: "custom", label: "Deep work (45m)" }], focus.mode)}
      </div>`)}
    ${sectionBlock("Work hours", "Used for scheduling and time-blocking suggestions.", `
      <div class="detail__grid">
        ${field("Start", `<input class="input" type="time" data-setting="workStart" value="${prefs.workStart}" />`)}
        ${field("End", `<input class="input" type="time" data-setting="workEnd" value="${prefs.workEnd}" />`)}
      </div>`)}
    ${sectionBlock("Behaviour", "Small automations that keep lists honest.", `
      ${switchRow("autoRollover", "Roll over unfinished tasks", "Undone tasks move to tomorrow automatically.", prefs.autoRollover, "prefs")}
      ${switchRow("confirmDelete", "Confirm before deleting", "Ask first when removing tasks, notes and goals.", prefs.confirmDelete, "prefs")}`)}`;
}

function notificationsSection() {
  const notes = getNotifications();
  return `
    ${sectionBlock("Reminders", "What Elevate nudges you about.", `
      ${switchRow("taskReminders", "Task reminders", "When a task with a time is due.", notes.taskReminders, "notifications")}
      ${switchRow("deadlineReminders", "Deadline reminders", "Ahead of due dates you care about.", notes.deadlineReminders, "notifications")}
      ${switchRow("habitReminders", "Habit reminders", "At each habit's reminder time.", notes.habitReminders, "notifications")}
      ${switchRow("overdueAlerts", "Overdue alerts", "A heads-up when things slip.", notes.overdueAlerts, "notifications")}
      ${switchRow("mentions", "Mentions & comments", "When a teammate mentions you.", notes.mentions, "notifications")}`)}
    ${sectionBlock("Digests", "Batched summaries instead of pings.", `
      ${switchRow("dailyPlanning", "Daily planning prompt", `A gentle prompt at ${notes.dailyPlanningTime}.`, notes.dailyPlanning, "notifications")}
      ${switchRow("weeklySummary", "Weekly summary", "Every Sunday evening.", notes.weeklySummary, "notifications")}
      ${switchRow("emailDigest", "Email digest", "Same summary, in your inbox.", notes.emailDigest, "notifications")}`)}
    ${sectionBlock("Quiet hours", "No notifications between these times.", `
      ${switchRow("quietHours", "Enable quiet hours", "Mutes everything overnight.", notes.quietHours.enabled, "notifications")}
      <div class="detail__grid mt-3">
        ${field("From", `<input class="input" type="time" data-setting="quietStart" value="${notes.quietHours.start}" />`)}
        ${field("To", `<input class="input" type="time" data-setting="quietEnd" value="${notes.quietHours.end}" />`)}
      </div>`)}
    ${sectionBlock("Desktop notifications", notificationsSupported()
      ? "Native browser notifications, even when Elevate is in another tab."
      : "This browser does not support desktop notifications.", `
      <button class="btn ${notes.desktopNotifications ? "btn--soft" : "btn--primary"}" type="button" data-act="enable-desktop">
        ${icon(notes.desktopNotifications ? "check" : "bell", 15)}
        ${notes.desktopNotifications ? "Desktop notifications on" : "Enable desktop notifications"}
      </button>`)}`;
}

function dataSection() {
  const bytes = storageBytes();
  const state = getState();
  const counts = {
    tasks: getTasks().length, projects: getProjects().length,
    notes: getNotes().length, habits: getHabits().length
  };
  const hasSample = Boolean(state.sampleData);
  return `
    ${sectionBlock("Sample data", "Load a fully-built demo workspace, or wipe everything back to empty.", `
      ${switchRow("sampleData", "Sample data", hasSample
    ? "Loaded — turn this off to clear every task, note, habit and event."
    : "Turn on to explore Elevate with example content.", hasSample, "sample")}`)}
    ${sectionBlock("Your data", "Everything lives in this browser's localStorage — nothing is uploaded.", `
      <div class="stat-grid mb-4">
        <div class="stat"><div class="stat__label">Storage used</div><div class="stat__value">${fileSize(bytes)}</div></div>
        <div class="stat"><div class="stat__label">Items</div><div class="stat__value">${counts.tasks + counts.projects + counts.notes + counts.habits}</div><div class="stat__foot">${counts.tasks} tasks · ${counts.notes} notes</div></div>
      </div>
      <div class="row gap-2 wrap">
        <button class="btn btn--primary" type="button" data-act="export">${icon("download", 15)} Export JSON</button>
        <button class="btn" type="button" data-act="import">${icon("upload", 15)} Import JSON</button>
        <button class="btn btn--danger" type="button" data-act="wipe">${icon("trash", 15)} Erase everything</button>
      </div>
      <input type="file" accept="application/json" id="st-import" hidden />`)}
    ${sectionBlock("Keyboard", "Shortcuts work across the app.", `
      <div class="col gap-2 fs-xs">
        <div class="row-between"><span>Command palette</span><span class="kbd">${modKey} K</span></div>
        <div class="row-between"><span>Quick add task</span><span class="kbd">Q</span></div>
        <div class="row-between"><span>Go to Dashboard</span><span class="kbd">G then D</span></div>
        <div class="row-between"><span>Close overlay</span><span class="kbd">Esc</span></div>
      </div>`)}`;
}

/* ----------------------------------------------------------------- Render */
const SECTION_BODY = {
  appearance: appearanceSection,
  preferences: preferencesSection,
  notifications: notificationsSection,
  data: dataSection
};

export function render(params = []) {
  const current = SECTION_BODY[params[0]] ? params[0] : "appearance";
  const meta = SECTIONS.find((section) => section.key === current) || SECTIONS[0];
  const body = (SECTION_BODY[current] || appearanceSection)();

  return `
    <header class="page-head">
      <div class="page-head__main">
        <div class="page-head__eyebrow">Workspace</div>
        <h1>Settings</h1>
        <p class="page-head__sub">Tune Elevate so it works the way you think.</p>
      </div>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">
        ${SECTIONS.map((section) => `
          <button class="folder-item${section.key === current ? " is-active" : ""}" type="button" data-section="${section.key}">
            ${icon(section.icon, 14)}
            <span class="grow truncate">${escapeHtml(section.label)}</span>
            ${section.key === current ? icon("chevron-right", 13) : ""}
          </button>`).join("")}
      </nav>

      <div class="settings-panel">
        <div>
          <div class="page-head__eyebrow">${escapeHtml(meta.label)}</div>
          <p class="page-head__sub">${escapeHtml(meta.desc)}</p>
        </div>
        ${body}
      </div>
    </div>`;
}


/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender, params = [] } = {}) {
  const refresh = () => { if (typeof rerender === "function") rerender(); };

  root.addEventListener("change", (event) => {
    const setting = event.target.closest("[data-setting]");
    if (!setting) return;
    const key = setting.dataset.setting;
    const value = setting.value;
    if (key === "startOfWeek") updatePreferences({ startOfWeek: Number(value) });
    else if (key === "defaultView") updatePreferences({ defaultView: value });
    else if (key === "defaultReminder") updatePreferences({ defaultReminder: Number(value) });
    else if (key === "focusMode") updateFocusPrefs({ mode: value });
    else if (key === "workStart" || key === "workEnd") updatePreferences({ [key]: value });
    else if (key === "quietStart") updateQuietHours({ start: value });
    else if (key === "quietEnd") updateQuietHours({ end: value });
    toast({ title: "Preference saved", type: "success", duration: 1200 });
    refresh();
  });

  root.addEventListener("change", async (event) => {
    if (!event.target.matches("#st-import")) return;
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      importState(text);
      toast({ title: "Data imported", desc: "Your workspace has been restored.", type: "success" });
      refresh();
    } catch (error) {
      toast({ title: "Import failed", desc: "That file is not a valid Elevate export.", type: "error" });
    }
  });

  root.addEventListener("click", async (event) => {
    const sectionBtn = event.target.closest("[data-section]");
    if (sectionBtn) { navigate("settings", sectionBtn.dataset.section); return; }

    const sw = event.target.closest("[data-switch]");
    if (sw) {
      const key = sw.dataset.switch;
      const group = sw.dataset.group;
      if (group === "sample") {
        const turningOn = !getState().sampleData;
        const run = () => {
          setSampleData(turningOn);
          refresh();
        };
        if (!turningOn) {
          confirmDialog({
            title: "Clear all sample data?",
            message: "Every task, project, note, habit, goal and event will be deleted. This cannot be undone.",
            confirmLabel: "Clear everything",
            danger: true
          }).then((ok) => { if (ok) run(); });
          return;
        }
        run();
        return;
      }
      if (group === "notifications") {
        if (key === "quietHours") updateQuietHours({ enabled: !getNotifications().quietHours.enabled });
        else updateNotifications({ [key]: !getNotifications()[key] });
      } else if (group === "prefs") updatePreferences({ [key]: !getPreferences()[key] });
      refresh();
      return;
    }

    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "theme":
        updateUi({ theme: action.dataset.theme });
        refresh();
        break;
      case "accent":
        updateUi({ accent: action.dataset.accent });
        refresh();
        break;
      case "density":
        updateUi({ density: action.dataset.density });
        refresh();
        break;
      case "enable-desktop": {
        const granted = await requestDesktopNotifications();
        updateNotifications({ desktopNotifications: Boolean(granted) });
        toast({
          title: granted ? "Desktop notifications on" : "Notifications blocked",
          desc: granted ? "Elevate can now nudge you natively." : "Allow notifications in your browser settings.",
          type: granted ? "success" : "warning"
        });
        refresh();
        break;
      }
      case "export":
        download(`elevate-export-${new Date().toISOString().slice(0, 10)}.json`, exportState());
        toast({ title: "Export downloaded", type: "success" });
        break;
      case "import":
        $("#st-import", root).click();
        break;
      case "wipe": {
        const ok = await confirmDialog({
          title: "Erase everything?",
          message: "All tasks, projects, notes, habits, goals and settings will be deleted permanently.",
          confirmLabel: "Erase all data",
          danger: true
        });
        if (ok) { clearAllData(); toast({ title: "All data erased", type: "info" }); refresh(); }
        break;
      }
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "settings",
  title: "Settings",
  icon: "settings",
  group: "Workspace",
  order: 1,
  nav: true,
  render,
  mount
}];

/* --SETTINGS-END-- */
