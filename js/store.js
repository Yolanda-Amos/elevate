/* ==========================================================================
   Elevate — Store: state, persistence, mutations, derived analytics
   Single source of truth. Views render from here; every mutation emits.
   ========================================================================== */
import {
  readStore, writeStore, clearStore, uid, todayISO, addDays, toISO, parseISO,
  diffDays, clamp, sum, percent, lastNDays, isPast, startOfWeek, nowHHMM
} from "./utils.js";
import { buildSeed, SEED_VERSION, BLOCK_TEMPLATES, AMBIENT_SOUNDS, DEMO_TEAM } from "./data.js";

const STORAGE_KEY = "state.v4";
export { BLOCK_TEMPLATES, AMBIENT_SOUNDS };

const DEFAULT_PREFERENCES = {
  startOfWeek: 1,
  workStart: "09:00",
  workEnd: "17:30",
  defaultView: "list",
  defaultReminder: 15,
  autoRollover: true,
  confirmDelete: true,
  denseMode: false
};

const DEFAULT_NOTIFICATIONS = {
  taskReminders: true,
  deadlineReminders: true,
  habitReminders: true,
  dailyPlanning: true,
  dailyPlanningTime: "08:30",
  overdueAlerts: true,
  weeklySummary: true,
  weeklySummaryDay: 0,
  mentions: true,
  desktopNotifications: false,
  emailDigest: false,
  quietHours: { enabled: true, start: "21:30", end: "07:00" }
};

export const FOLDERS = [
  { id: "f_work", name: "Work", icon: "folder" },
  { id: "f_personal", name: "Personal", icon: "heart" },
  { id: "f_learning", name: "Learning", icon: "book" },
  { id: "f_ideas", name: "Ideas", icon: "spark" }
];

export const ROLE_PERMISSIONS = {
  Owner: ["manage_workspace", "billing", "invite", "edit", "delete", "comment", "view"],
  Admin: ["invite", "edit", "delete", "comment", "view"],
  Member: ["edit", "comment", "view"],
  Viewer: ["view"]
};

function buildHabits() {
  const defs = [
    { name: "Read", icon: "book", color: "#5b5bd6", cadence: "daily", target: 30, unit: "pages" },
    { name: "Exercise", icon: "dumbbell", color: "#159a63", cadence: "daily", target: 1, unit: "session" },
    { name: "Pray", icon: "spark", color: "#c07409", cadence: "daily", target: 5, unit: "times" },
    { name: "Drink water", icon: "droplet", color: "#2f6fd0", cadence: "daily", target: 8, unit: "glasses" },
    { name: "Study", icon: "target", color: "#0f8a83", cadence: "weekdays", target: 45, unit: "minutes" },
    { name: "Journal", icon: "note", color: "#c8437c", cadence: "daily", target: 1, unit: "entry" }
  ];
  return defs.map((h, i) => ({
    id: `h_${h.name.toLowerCase().replace(/\s+/g, "_")}`,
    name: h.name,
    description: "",
    icon: h.icon,
    color: h.color,
    cadence: h.cadence,
    days: h.cadence === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6],
    target: h.target,
    unit: h.unit,
    reminder: i % 2 === 0 ? "07:30" : "",
    streakProtection: i < 3,
    archived: false,
    createdAt: Date.now() - (30 - i) * 86400000,
    order: i
  }));
}

/** 12 weeks of realistic habit history, including a live streak. */
function buildHabitLogs(habits) {
  const logs = {};
  habits.forEach((habit, hi) => {
    logs[habit.id] = {};
    for (let d = 84; d >= 0; d -= 1) {
      const date = addDays(todayISO(), -d);
      const dow = parseISO(date).getDay();
      if (!habit.days.includes(dow)) continue;
      const seed = (hi * 7 + d * 13) % 10;
      const hit = d === 0 ? seed > 4 : seed > 2;
      if (hit) logs[habit.id][date] = habit.target;
    }
  });
  return logs;
}

function buildGoals() {
  const iso = (n) => addDays(todayISO(), n);
  return [
    {
      id: "g_ship", title: "Ship Elevate v2", description: "Launch the next major version with onboarding and AI planning.",
      type: "milestone", projectId: "p_product", color: "#5b5bd6", icon: "trending",
      dueDate: iso(45), status: "active", createdAt: Date.now() - 40 * 86400000,
      milestones: [
        { id: uid("ms"), title: "Finalise scope", done: true },
        { id: uid("ms"), title: "Build onboarding flow", done: true },
        { id: uid("ms"), title: "Beta with 20 users", done: false },
        { id: uid("ms"), title: "Public launch", done: false }
      ]
    },
    {
      id: "g_reading", title: "Read 24 books this year", description: "A steady 30 pages a day compounds fast.",
      type: "metric", projectId: "p_personal", color: "#c07409", icon: "book",
      target: 24, current: 15, unit: "books", dueDate: toISO(new Date(new Date().getFullYear(), 11, 31)),
      status: "active", createdAt: Date.now() - 200 * 86400000, milestones: []
    },
    {
      id: "g_money", title: "Build a 6-month emergency fund", description: "Automatic transfer on the 1st of each month.",
      type: "metric", projectId: "p_personal", color: "#159a63", icon: "wallet",
      target: 6000, current: 3450, unit: "USD", dueDate: iso(180), status: "active",
      createdAt: Date.now() - 120 * 86400000,
      milestones: [
        { id: uid("ms"), title: "First 1,000 saved", done: true },
        { id: uid("ms"), title: "Reach 3 months", done: true },
        { id: uid("ms"), title: "Reach 6 months", done: false }
      ]
    },
    {
      id: "g_access", title: "Make the app accessible to everyone", description: "WCAG AA across all core flows.",
      type: "milestone", projectId: "p_learning", color: "#2f6fd0", icon: "shield",
      dueDate: iso(30), status: "active", createdAt: Date.now() - 25 * 86400000,
      milestones: [
        { id: uid("ms"), title: "Contrast audit", done: true },
        { id: uid("ms"), title: "Keyboard navigation", done: false },
        { id: uid("ms"), title: "Screen reader pass", done: false }
      ]
    }
  ];
}

function buildNotes() {
  const day = 86400000;
  return [
    {
      id: "n_launch", title: "Launch checklist", folderId: "f_work", pinned: true,
      body: "1. Freeze scope\n2. QA dark mode + mobile\n3. Draft announcements\n4. Schedule the email\n5. Watch the dashboards for 48h",
      tags: ["work"],
      checklist: [{ id: uid("c"), title: "Freeze scope", done: true }, { id: uid("c"), title: "QA pass", done: false }],
      linkedTaskId: null, linkedProjectId: "p_product", createdAt: Date.now() - 9 * day, updatedAt: Date.now() - 2 * day
    },
    {
      id: "n_meeting", title: "Client sync — Northwind", folderId: "f_work", pinned: false,
      body: "Agenda:\n• Q3 numbers recap\n• Dashboard feedback\n• Retainer renewal options\n\nDecision: renew for two quarters, revisit analytics scope in October.",
      tags: ["work", "meeting"], checklist: [], linkedTaskId: null, linkedProjectId: "p_client",
      createdAt: Date.now() - 6 * day, updatedAt: Date.now() - 4 * day
    },
    {
      id: "n_ideas", title: "Ideas parking lot", folderId: "f_ideas", pinned: true,
      body: "— Weekly review template inside the app\n— Auto time-block from priorities\n— Offline-first sync for mobile\n— Public API for integrations",
      tags: ["personal"], checklist: [], linkedTaskId: null, linkedProjectId: null,
      createdAt: Date.now() - 20 * day, updatedAt: Date.now() - day
    },
    {
      id: "n_reading", title: "Reading notes — Thinking in Systems", folderId: "f_learning", pinned: false,
      body: "Stocks and flows beat events. Look for the delay between action and feedback — that is usually where the leverage hides.",
      tags: ["school"], checklist: [], linkedTaskId: null, linkedProjectId: null,
      createdAt: Date.now() - 14 * day, updatedAt: Date.now() - 5 * day
    }
  ];
}

function buildEvents() {
  const iso = (n) => addDays(todayISO(), n);
  return [
    { id: uid("ev"), title: "Daily standup", date: todayISO(), start: "09:30", end: "09:45", location: "Zoom", attendees: ["u_me", "u_tunde", "u_zara"], projectId: "p_product", color: "#2f6fd0", kind: "meeting" },
    { id: uid("ev"), title: "Northwind client call", date: todayISO(), start: "14:00", end: "15:00", location: "Google Meet", attendees: ["u_me", "u_leo"], projectId: "p_client", color: "#0f8a83", kind: "meeting" },
    { id: uid("ev"), title: "Design critique", date: iso(1), start: "11:00", end: "12:00", location: "Studio", attendees: ["u_me", "u_zara"], projectId: "p_website", color: "#5b5bd6", kind: "meeting" },
    { id: uid("ev"), title: "Mentorship call", date: iso(2), start: "16:00", end: "16:45", location: "Phone", attendees: ["u_me"], projectId: "p_learning", color: "#c07409", kind: "meeting" },
    { id: uid("ev"), title: "Sprint planning", date: iso(3), start: "10:00", end: "11:30", location: "Zoom", attendees: ["u_me", "u_tunde", "u_zara", "u_leo"], projectId: "p_product", color: "#2f6fd0", kind: "meeting" }
  ];
}

function buildFocusSessions() {
  const sessions = [];
  const labels = ["Deep Work", "Project Work", "Writing", "Review", "Study"];
  for (let d = 20; d >= 0; d -= 1) {
    const count = d === 0 ? 3 : [0, 1, 2, 3, 4][d % 5];
    for (let i = 0; i < count; i += 1) {
      const isBreak = i === count - 1 && count > 2;
      const minutes = isBreak ? (d % 6 === 0 ? 15 : 5) : [25, 45, 50, 30][(d + i) % 4];
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - d);
      startedAt.setHours(8 + ((i * 2 + d) % 9), (i * 7) % 60, 0, 0);
      sessions.push({
        id: uid("fs"),
        mode: isBreak ? (minutes > 10 ? "long-break" : "short-break") : (d + i) % 2 === 0 ? "pomodoro" : "custom",
        label: isBreak ? "Break" : labels[(d + i) % labels.length],
        taskId: null,
        minutes,
        completed: (d + i) % 7 !== 0,
        startedAt: startedAt.getTime(),
        endedAt: startedAt.getTime() + minutes * 60000
      });
    }
  }
  return sessions;
}

function buildActivity() {
  const items = [
    { who: "u_zara", text: "completed “Design tokens audit”", type: "complete" },
    { who: "u_tunde", text: "commented on “Review pull request #482”", type: "comment" },
    { who: "u_me", text: "created project “Northwind Client Work”", type: "create" },
    { who: "u_leo", text: "moved “Build analytics empty states” to Review", type: "move" },
    { who: "u_me", text: "started a 50 minute focus session", type: "focus" },
    { who: "u_nia", text: "joined the workspace as Viewer", type: "team" }
  ];
  return items.map((item, i) => ({ id: uid("act"), ...item, at: Date.now() - (i + 1) * 3600000 * 5, entityId: null }));
}

function createState() {
  return {
    version: SEED_VERSION,
    /* Content starts empty — sample data is opt-in from Settings → Data. */
    sampleData: false,
    onboarded: false,
    createdAt: Date.now(),
    user: {
      id: "u_me",
      /* No name: the app greets you without assuming who you are. */
      name: "",
      email: "",
      avatar: "",
      color: "#5b5bd6",
      role: "Owner",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      plan: "premium",
      billing: "monthly",
      goals: [],
      workType: "",
      areas: [],
      organizePref: "",
      productivityGoals: [],
      bio: ""
    },
    /* Just the account holder — invite teammates from the Team view. */
    team: [{ ...DEMO_TEAM[0], name: "", email: "" }],
    teamWorkspace: { id: "ws_elevate", name: "My workspace", plan: "free", seatLimit: 12 },
    preferences: { ...DEFAULT_PREFERENCES },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    ui: {
      theme: "light",
      accent: "violet",
      density: "comfortable",
      sidebarCollapsed: false,
      lastRoute: "dashboard",
      taskView: "list",
      taskGroup: "date",
      taskSort: "due",
      taskFilters: { status: "open", priority: "all", projectId: "all", tagId: "all", search: "" },
      calendarView: "month",
      calendarDate: todayISO(),
      dismissedHints: [],
      recent: []
    },
    projects: [],
    sections: [],
    /* Board columns are structure, not content — an empty board still needs lanes. */
    columns: DEFAULT_COLUMNS(),
    tags: [],
    tasks: [],
    habits: [],
    habitLogs: {},
    goals: [],
    notes: [],
    folders: FOLDERS.map((f) => ({ ...f })),
    events: [],
    focusSessions: [],
    focus: { mode: "pomodoro", durations: { pomodoro: 25, shortBreak: 5, longBreak: 15, custom: 45 }, sound: "brown", soundVolume: 0.4 },
    activity: [],
    reminders: { sent: {} },
    streak: { current: 0, best: 0 },
    plan: { name: "free", trialEndsAt: null, seats: 12, renewsAt: null }
  };
}

/* ------------------------------------------------------- State + pub/sub */
const listeners = new Set();
let state = null;

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function emit(reason = "update") {
  persist();
  listeners.forEach((fn) => {
    try { fn(state, reason); } catch (error) { console.error("Elevate: listener failed", error); }
  });
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeStore(STORAGE_KEY, state), 90);
}

export function hydrate() {
  const stored = readStore(STORAGE_KEY, null);
  const fresh = createState();
  if (stored && stored.version === SEED_VERSION) {
    state = { ...fresh, ...stored };
    state.user = { ...fresh.user, ...(stored.user || {}) };
    state.preferences = { ...DEFAULT_PREFERENCES, ...(stored.preferences || {}) };
    state.notifications = { ...DEFAULT_NOTIFICATIONS, ...(stored.notifications || {}) };
    state.notifications.quietHours = { ...DEFAULT_NOTIFICATIONS.quietHours, ...((stored.notifications || {}).quietHours || {}) };
    state.ui = { ...fresh.ui, ...(stored.ui || {}) };
    state.ui.taskFilters = { ...fresh.ui.taskFilters, ...((stored.ui || {}).taskFilters || {}) };
    state.focus = { ...fresh.focus, ...(stored.focus || {}) };
    return state;
  }
  state = fresh;
  persist();
  return state;
}

export function resetState() {
  state = createState();
  emit("reset");
  return state;
}

/** Board lanes are structure, so they survive a wipe. */
const DEFAULT_COLUMNS = () => [
  { id: "col_todo", name: "To do", order: 0 },
  { id: "col_doing", name: "In progress", order: 1 },
  { id: "col_done", name: "Done", order: 2 }
];

/**
 * The default workspace is completely empty. Sample data is opt-in so a new
 * user never opens the app looking at someone else's to-do list.
 */
function emptyContent() {
  return {
    projects: [], sections: [], columns: DEFAULT_COLUMNS(), tags: [], tasks: [],
    habits: [], habitLogs: {}, goals: [], notes: [], events: [],
    focusSessions: [], activity: []
  };
}

/** Swaps the workspace content between empty and fully-seeded. */
export function setSampleData(enabled) {
  if (enabled) {
    const seed = buildSeed();
    const habits = buildHabits();
    state.projects = seed.projects;
    state.sections = seed.sections;
    state.columns = seed.columns;
    state.tags = seed.tags;
    state.tasks = seed.tasks;
    state.habits = habits;
    state.habitLogs = buildHabitLogs(habits);
    state.goals = buildGoals();
    state.notes = buildNotes();
    state.folders = FOLDERS.map((folder) => ({ ...folder }));
    state.events = buildEvents();
    state.focusSessions = buildFocusSessions();
    state.activity = buildActivity();
    state.sampleData = true;
    logActivity("loaded the sample workspace");
  } else {
    Object.assign(state, emptyContent());
    state.folders = FOLDERS.map((folder) => ({ ...folder }));
    state.reminders = { sent: {} };
    state.sampleData = false;
  }
  emit("sample-data");
  return state;
}

export const hasSampleData = () => Boolean(state && state.sampleData);

export function clearAllData() {
  clearStore(STORAGE_KEY);
  state = createState();
  state.onboarded = false;
  emit("clear");
  return state;
}

export function exportState() {
  return JSON.stringify({ app: "Elevate", exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importState(json) {
  const parsed = typeof json === "string" ? JSON.parse(json) : json;
  const incoming = parsed && parsed.state ? parsed.state : parsed;
  if (!incoming || !Array.isArray(incoming.tasks)) throw new Error("That file does not look like an Elevate backup.");
  state = { ...createState(), ...incoming, version: SEED_VERSION };
  emit("import");
  return state;
}

/* ----------------------------------------------------------- Preferences */
export const updatePreferences = (patch) => { state.preferences = { ...state.preferences, ...patch }; emit("preferences"); };
export const updateNotifications = (patch) => {
  state.notifications = { ...state.notifications, ...patch };
  emit("notifications");
};
export const updateQuietHours = (patch) => {
  state.notifications.quietHours = { ...state.notifications.quietHours, ...patch };
  emit("notifications");
};
export const updateProfile = (patch) => { state.user = { ...state.user, ...patch }; emit("profile"); };
export const completeOnboarding = (patch = {}) => { state.onboarded = true; state.user = { ...state.user, ...patch }; emit("onboarding"); };
export const updateUi = (patch) => { state.ui = { ...state.ui, ...patch }; emit("ui"); };
export const updateTaskFilters = (patch) => { state.ui.taskFilters = { ...state.ui.taskFilters, ...patch }; emit("filters"); };
export const toggleSidebar = () => { state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed; emit("ui"); };
export const pushRecent = (item) => {
  state.ui.recent = [item, ...state.ui.recent.filter((r) => r.id !== item.id)].slice(0, 8);
  persist();
};

/* ------------------------------------------------------------ Collection */
export const getTasks = () => state.tasks.filter((t) => !t.archived);
export const getAllTasks = () => state.tasks;
export const getTask = (id) => state.tasks.find((t) => t.id === id) || null;
export const getTasksByIds = (ids = []) => ids.map(getTask).filter(Boolean);
export const getProjects = () => state.projects.filter((p) => !p.archived);
export const getAllProjects = () => state.projects;
export const getProject = (id) => state.projects.find((p) => p.id === id) || null;
export const getSections = (projectId) =>
  state.sections.filter((s) => (projectId ? s.projectId === projectId : true)).sort((a, b) => a.order - b.order);
export const getSection = (id) => state.sections.find((s) => s.id === id) || null;
export const getColumns = () => [...state.columns].sort((a, b) => a.order - b.order);
export const getColumn = (id) => state.columns.find((c) => c.id === id) || null;
export const getTags = () => state.tags;
export const getTag = (id) => state.tags.find((t) => t.id === id) || null;
export const getTagByName = (name) =>
  state.tags.find((t) => t.name.toLowerCase() === String(name || "").toLowerCase()) || null;
export const getHabits = () => state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
export const getHabit = (id) => state.habits.find((h) => h.id === id) || null;
export const getGoals = () => state.goals;
export const getGoal = (id) => state.goals.find((g) => g.id === id) || null;
export const getNotes = () => state.notes;
export const getNote = (id) => state.notes.find((n) => n.id === id) || null;
export const getFolders = () => state.folders;
export const getEvents = () => state.events;
export const getEventsForDate = (date) => state.events.filter((e) => e.date === date);
export const getFocusSessions = () => [...state.focusSessions].sort((a, b) => b.startedAt - a.startedAt);
export const getActivity = () => [...state.activity].sort((a, b) => b.at - a.at);
export const getMembers = () => state.team;
export const getMember = (id) => state.team.find((m) => m.id === id) || null;
export const currentUser = () => state.user;

/** Falls back to "You" so nameless accounts still read naturally. */
export const displayName = (person) => {
  const name = person && typeof person.name === "string" ? person.name.trim() : "";
  return name || "You";
};
export const getPreferences = () => state.preferences;
export const getNotifications = () => state.notifications;
export const getUi = () => state.ui;
export const getFocusPrefs = () => state.focus;
export const getPlan = () => state.plan;

export function logActivity(text, { type = "update", who = null, entityId = null } = {}) {
  state.activity.unshift({ id: uid("act"), who: who || state.user.id, text, type, entityId, at: Date.now() });
  state.activity = state.activity.slice(0, 60);
}

/* ----------------------------------------------------------- Task helpers */
const normalizeTask = (partial = {}) => ({
  id: uid("task"),
  title: "Untitled task",
  description: "",
  notes: "",
  status: "todo",
  completedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  dueDate: null,
  dueTime: null,
  priority: "none",
  projectId: null,
  sectionId: null,
  columnId: "col_todo",
  tagIds: [],
  subtasks: [],
  attachments: [],
  estimatedMinutes: 0,
  actualMinutes: 0,
  recurrence: null,
  reminder: null,
  location: "",
  dependsOn: [],
  comments: [],
  assignees: ["u_me"],
  createdBy: state.user.id,
  myDay: false,
  order: state.tasks.length,
  timeBlock: null,
  archived: false,
  snoozedUntil: null,
  ...partial
});

const nextRecurrenceDate = (task) => {
  const { freq, interval = 1 } = task.recurrence || {};
  if (!freq) return null;
  let cursor = task.dueDate;
  for (let i = 0; i < interval; i += 1) {
    if (freq === "daily") {
      cursor = addDays(cursor, 1);
    } else if (freq === "weekdays") {
      cursor = addDays(cursor, 1);
      while ([0, 6].includes(parseISO(cursor).getDay())) cursor = addDays(cursor, 1);
    } else if (freq === "weekly") {
      const days = task.recurrence.byDay && task.recurrence.byDay.length ? task.recurrence.byDay : [parseISO(cursor).getDay()];
      cursor = addDays(cursor, 1);
      let guard = 0;
      while (!days.includes(parseISO(cursor).getDay()) && guard < 370) { cursor = addDays(cursor, 1); guard += 1; }
    } else if (freq === "monthly") {
      const d = parseISO(cursor);
      cursor = toISO(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    } else if (freq === "yearly") {
      const d = parseISO(cursor);
      cursor = toISO(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
    } else {
      return null;
    }
  }
  return cursor;
};

export function createTask(partial = {}) {
  const task = normalizeTask(partial);
  state.tasks.unshift(task);
  const project = task.projectId ? getProject(task.projectId) : null;
  logActivity(`created “${task.title}”${project ? ` in ${project.name}` : ""}`, { type: "create", entityId: task.id });
  emit("task:create");
  return task;
}

export function updateTask(id, patch = {}) {
  const task = getTask(id);
  if (!task) return null;
  Object.assign(task, patch, { updatedAt: Date.now() });
  if (patch.status === "done" && !task.completedAt) task.completedAt = Date.now();
  if (patch.status === "todo") task.completedAt = null;
  emit("task:update");
  return task;
}

export function toggleTask(id, { silent = false } = {}) {
  const task = getTask(id);
  if (!task) return null;
  const nowDone = task.status !== "done";
  task.status = nowDone ? "done" : "todo";
  task.completedAt = nowDone ? Date.now() : null;
  task.updatedAt = Date.now();

  if (nowDone) {
    task.columnId = "col_done";
    task.subtasks.forEach((sub) => { sub.done = true; });
    logActivity(`completed “${task.title}”`, { type: "complete", entityId: task.id });
    if (task.recurrence && task.dueDate) {
      const next = nextRecurrenceDate(task);
      if (next) {
        const clone = normalizeTask({
          ...task,
          id: uid("task"),
          status: "todo",
          completedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          dueDate: next,
          columnId: "col_todo",
          subtasks: task.subtasks.map((s) => ({ ...s, id: uid("sub"), done: false })),
          comments: [],
          myDay: false
        });
        state.tasks.unshift(clone);
      }
    }
  } else {
    task.columnId = "col_todo";
    logActivity(`reopened “${task.title}”`, { type: "update", entityId: task.id });
  }
  if (!silent) emit("task:toggle");
  return task;
}

export function deleteTask(id) {
  const task = getTask(id);
  if (!task) return false;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  state.tasks.forEach((t) => { t.dependsOn = (t.dependsOn || []).filter((dep) => dep !== id); });
  logActivity(`deleted “${task.title}”`, { type: "delete" });
  emit("task:delete");
  return true;
}

export function duplicateTask(id) {
  const task = getTask(id);
  if (!task) return null;
  const copy = normalizeTask({
    ...task,
    id: uid("task"),
    title: `${task.title} (copy)`,
    status: "todo",
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: state.tasks.length,
    subtasks: task.subtasks.map((s) => ({ ...s, id: uid("sub"), done: false })),
    comments: []
  });
  state.tasks.unshift(copy);
  logActivity(`duplicated “${task.title}”`, { type: "create", entityId: copy.id });
  emit("task:duplicate");
  return copy;
}

export function archiveTask(id) {
  const task = getTask(id);
  if (!task) return null;
  task.archived = true;
  task.archivedAt = Date.now();
  logActivity(`archived “${task.title}”`, { type: "archive", entityId: id });
  emit("task:archive");
  return task;
}

export function restoreTask(id) {
  const task = getTask(id);
  if (!task) return null;
  task.archived = false;
  task.archivedAt = null;
  emit("task:restore");
  return task;
}

/* --------------------------------------------------- Task operations (2a) */
export function snoozeTask(id, days = 1) {
  const task = getTask(id);
  if (!task) return null;
  const base = task.dueDate && diffDays(task.dueDate, todayISO()) >= 0 ? task.dueDate : todayISO();
  task.dueDate = addDays(base, days);
  task.snoozedUntil = Date.now() + days * 86400000;
  task.updatedAt = Date.now();
  emit("task:snooze");
  return task;
}

export function snoozeMinutes(id, minutes = 60) {
  const task = getTask(id);
  if (!task) return null;
  task.snoozedUntil = Date.now() + minutes * 60000;
  emit("task:snooze");
  return task;
}

export function rescheduleTask(id, date, time = undefined) {
  const task = getTask(id);
  if (!task) return null;
  task.dueDate = date || null;
  if (time !== undefined) task.dueTime = time || null;
  task.snoozedUntil = null;
  task.updatedAt = Date.now();
  emit("task:reschedule");
  return task;
}

/** Quick date shortcuts used by menus, the command palette and swipe actions. */
export function applyDateShortcut(id, shortcut) {
  let date = null;
  if (shortcut === "today") date = todayISO();
  else if (shortcut === "tomorrow") date = addDays(todayISO(), 1);
  else if (shortcut === "weekend") {
    const dow = parseISO(todayISO()).getDay();
    date = addDays(todayISO(), (6 - dow + 7) % 7 || 6);
  } else if (shortcut === "nextweek") date = addDays(startOfWeek(todayISO()), 7);
  else date = null;
  return rescheduleTask(id, date);
}

export function moveTask(id, { projectId, sectionId, columnId } = {}) {
  const task = getTask(id);
  if (!task) return null;
  if (projectId !== undefined) {
    task.projectId = projectId || null;
    if (sectionId === undefined) task.sectionId = null;
  }
  if (sectionId !== undefined) task.sectionId = sectionId || null;
  if (columnId !== undefined) {
    task.columnId = columnId;
    if (columnId === "col_done") { task.status = "done"; task.completedAt = Date.now(); }
    else if (task.status === "done") { task.status = "todo"; task.completedAt = null; }
  }
  task.updatedAt = Date.now();
  emit("task:move");
  return task;
}

/** Reorders a task within a list, inserting before `beforeId` (or at the end). */
export function reorderTask(id, beforeId, scope = {}) {
  const list = scope.projectId ? getTasks().filter((t) => t.projectId === scope.projectId) : getTasks();
  const ordered = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const moving = ordered.find((t) => t.id === id);
  if (!moving) return null;
  const without = ordered.filter((t) => t.id !== id);
  const index = beforeId ? without.findIndex((t) => t.id === beforeId) : -1;
  without.splice(index === -1 ? without.length : index, 0, moving);
  without.forEach((task, i) => { task.order = i; task.updatedAt = Date.now(); });
  emit("task:reorder");
  return without;
}

export function setMyDay(id, value) {
  const task = getTask(id);
  if (!task) return null;
  task.myDay = value === undefined ? !task.myDay : Boolean(value);
  task.updatedAt = Date.now();
  emit("task:myday");
  return task;
}

export const setPriority = (id, priority) => updateTask(id, { priority });

/* --------------------------------------------------- Task operations (2b) */
export function addSubtask(taskId, title) {
  const task = getTask(taskId);
  if (!task || !title || !title.trim()) return null;
  const sub = { id: uid("sub"), title: title.trim(), done: false };
  task.subtasks.push(sub);
  task.updatedAt = Date.now();
  emit("subtask:add");
  return sub;
}

export function toggleSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  const sub = task && task.subtasks.find((s) => s.id === subtaskId);
  if (!sub) return null;
  sub.done = !sub.done;
  task.updatedAt = Date.now();
  emit("subtask:toggle");
  return sub;
}

export function updateSubtask(taskId, subtaskId, patch) {
  const task = getTask(taskId);
  const sub = task && task.subtasks.find((s) => s.id === subtaskId);
  if (!sub) return null;
  Object.assign(sub, patch);
  emit("subtask:update");
  return sub;
}

export function removeSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  if (!task) return null;
  task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
  emit("subtask:remove");
  return task;
}

/** Turns a task into a subtask of another task, then removes the original. */
export function convertToSubtask(taskId, parentId) {
  const task = getTask(taskId);
  const parent = getTask(parentId);
  if (!task || !parent || task.id === parent.id) return null;
  parent.subtasks.push({ id: uid("sub"), title: task.title, done: task.status === "done" });
  parent.updatedAt = Date.now();
  return deleteTask(taskId);
}

const extractMentions = (text) =>
  (String(text).match(/@[\w.]+/g) || []).map((m) => m.slice(1).toLowerCase());

export function addComment(taskId, text, authorId = null) {
  const task = getTask(taskId);
  if (!task || !text || !text.trim()) return null;
  const comment = {
    id: uid("cm"), authorId: authorId || state.user.id,
    text: text.trim(), at: Date.now(), mentions: extractMentions(text)
  };
  task.comments.push(comment);
  logActivity(`commented on “${task.title}”`, { type: "comment", entityId: task.id });
  emit("comment:add");
  return comment;
}

export function deleteComment(taskId, commentId) {
  const task = getTask(taskId);
  if (!task) return null;
  task.comments = task.comments.filter((c) => c.id !== commentId);
  emit("comment:delete");
  return task;
}

export function addAttachment(taskId, file) {
  const task = getTask(taskId);
  if (!task) return null;
  const attachment = { id: uid("att"), name: file.name, size: file.size, type: file.type || "file", addedAt: Date.now() };
  task.attachments.push(attachment);
  emit("attachment:add");
  return attachment;
}

export function removeAttachment(taskId, attachmentId) {
  const task = getTask(taskId);
  if (!task) return null;
  task.attachments = task.attachments.filter((a) => a.id !== attachmentId);
  emit("attachment:remove");
  return task;
}

export function linkDependency(taskId, dependencyId) {
  const task = getTask(taskId);
  if (!task || taskId === dependencyId) return null;
  task.dependsOn = Array.from(new Set([...(task.dependsOn || []), dependencyId]));
  emit("dependency:add");
  return task;
}

export function unlinkDependency(taskId, dependencyId) {
  const task = getTask(taskId);
  if (!task) return null;
  task.dependsOn = (task.dependsOn || []).filter((d) => d !== dependencyId);
  emit("dependency:remove");
  return task;
}

export function setTimeBlock(taskId, block) {
  const task = getTask(taskId);
  if (!task) return null;
  task.timeBlock = block;
  if (block && block.date) task.dueDate = block.date;
  if (block && block.start) task.dueTime = block.start;
  emit("task:timeblock");
  return task;
}

export const setRecurrence = (taskId, recurrence) => updateTask(taskId, { recurrence: recurrence || null });

export function bulkUpdate(ids = [], patch = {}) {
  ids.forEach((id) => {
    const task = getTask(id);
    if (task) Object.assign(task, patch, { updatedAt: Date.now() });
  });
  emit("task:bulk");
}

/* ------------------------------------------------------------ Task queries */
const byDue = (a, b) => {
  const aKey = a.dueDate || "9999-12-31";
  const bKey = b.dueDate || "9999-12-31";
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  const aTime = a.dueTime || "23:59";
  const bTime = b.dueTime || "23:59";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return (a.order ?? 0) - (b.order ?? 0);
};

const byPriorityThenDue = (a, b) => {
  const weight = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  const diff = (weight[a.priority] ?? 4) - (weight[b.priority] ?? 4);
  return diff !== 0 ? diff : byDue(a, b);
};

const isOpen = (task) => task.status !== "done";
const notSnoozed = (task) => !task.snoozedUntil || task.snoozedUntil <= Date.now();

export function inboxTasks() {
  return getTasks().filter((t) => isOpen(t) && !t.projectId && notSnoozed(t)).sort(byDue);
}

export function myDayTasks() {
  const today = todayISO();
  return getTasks()
    .filter((t) => isOpen(t) && notSnoozed(t) && (t.myDay || t.dueDate === today || (t.timeBlock && t.timeBlock.date === today)))
    .sort(byDue);
}

export function todayTasks({ includeDone = false } = {}) {
  const today = todayISO();
  return getTasks().filter((t) => t.dueDate === today && (includeDone || isOpen(t)) && notSnoozed(t)).sort(byDue);
}

export function overdueTasks() {
  const today = todayISO();
  return getTasks().filter((t) => isOpen(t) && t.dueDate && t.dueDate < today && notSnoozed(t)).sort(byDue);
}

export function upcomingTasks(days = 14) {
  const today = todayISO();
  const limit = addDays(today, days);
  return getTasks().filter((t) => isOpen(t) && t.dueDate && t.dueDate > today && t.dueDate <= limit).sort(byDue);
}

export function unscheduledTasks() {
  return getTasks().filter((t) => isOpen(t) && !t.dueDate).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export const tasksByProject = (projectId) => getTasks().filter((t) => t.projectId === projectId);

export const tasksBySection = (projectId, sectionId) =>
  getTasks().filter((t) => t.projectId === projectId && (sectionId ? t.sectionId === sectionId : true));

export const tasksByColumn = (columnId, projectId = null) =>
  getTasks()
    .filter((t) => t.columnId === columnId && (projectId ? t.projectId === projectId : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const tasksByTag = (tagId) => getTasks().filter((t) => t.tagIds.includes(tagId));
export const tasksByMember = (memberId) => getTasks().filter((t) => (t.assignees || []).includes(memberId));
export const tasksWithBlocks = (date) => getTasks().filter((t) => t.timeBlock && t.timeBlock.date === date);

export const tasksDueOn = (date, { includeDone = true } = {}) =>
  getTasks().filter((t) => t.dueDate === date && (includeDone || isOpen(t))).sort(byDue);

export const archivedTasks = () =>
  getAllTasks().filter((t) => t.archived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

export const openTaskCount = () => getTasks().filter(isOpen).length;

export function myTasksView() {
  const filters = getUi().taskFilters;
  let list = getTasks();
  if (filters.status === "open") list = list.filter(isOpen);
  else if (filters.status === "done") list = list.filter((t) => !isOpen(t));
  else if (filters.status === "overdue") list = list.filter((t) => isOpen(t) && t.dueDate && isPast(t.dueDate));
  else if (filters.status === "today") list = list.filter((t) => t.dueDate === todayISO());
  else if (filters.status === "nodate") list = list.filter((t) => !t.dueDate);

  if (filters.priority !== "all") list = list.filter((t) => t.priority === filters.priority);
  if (filters.projectId !== "all") {
    list = filters.projectId === "none"
      ? list.filter((t) => !t.projectId)
      : list.filter((t) => t.projectId === filters.projectId);
  }
  if (filters.tagId !== "all") list = list.filter((t) => t.tagIds.includes(filters.tagId));
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    list = list.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(needle));
  }

  const sortMode = getUi().taskSort;
  if (sortMode === "priority") return [...list].sort(byPriorityThenDue);
  if (sortMode === "created") return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (sortMode === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (sortMode === "manual") return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return [...list].sort(byDue);
}

export function groupTasks(list, mode = "date") {
  const groups = new Map();
  const push = (key, label, meta, task) => {
    if (!groups.has(key)) groups.set(key, { key, label, meta, tasks: [] });
    groups.get(key).tasks.push(task);
  };

  list.forEach((task) => {
    if (mode === "priority") {
      const label = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low", none: "No priority" }[task.priority] || "No priority";
      push(`p_${task.priority}`, label, "", task);
    } else if (mode === "project") {
      const project = task.projectId ? getProject(task.projectId) : null;
      push(`pr_${task.projectId || "none"}`, project ? project.name : "No project", project ? "" : "Inbox", task);
    } else if (mode === "status") {
      push(task.status === "done" ? "s_done" : "s_open", task.status === "done" ? "Completed" : "Open", "", task);
    } else if (mode === "flat") {
      push("all", "", "", task);
    } else {
      const today = todayISO();
      let key = "later";
      let label = dateLabel(task.dueDate);
      if (!task.dueDate) { key = "none"; label = "No date"; }
      else if (task.dueDate < today) { key = "overdue"; label = "Overdue"; }
      else if (task.dueDate === today) { key = "today"; label = "Today"; }
      else if (task.dueDate === addDays(today, 1)) { key = "tomorrow"; label = "Tomorrow"; }
      else if (task.dueDate <= addDays(today, 7)) { key = "week"; label = "This week"; }
      push(key, label, "", task);
    }
  });

  const order = ["overdue", "today", "tomorrow", "week", "later", "none", "all", "s_open", "s_done"];
  return [...groups.values()].sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const dateLabel = (date) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "Later";

/* ---------------------------------------------------------------- Search */
export function searchAll(query = "", filters = {}) {
  const needle = String(query || "").trim().toLowerCase();
  const matches = (text) => !needle || String(text || "").toLowerCase().includes(needle);
  const results = { tasks: [], projects: [], goals: [], habits: [], notes: [], events: [], tags: [] };

  results.tasks = getTasks().filter((task) => {
    if (!matches(`${task.title} ${task.description} ${task.notes}`)) return false;
    if (filters.priority && filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.projectId && filters.projectId !== "all" && task.projectId !== filters.projectId) return false;
    if (filters.tagId && filters.tagId !== "all" && !task.tagIds.includes(filters.tagId)) return false;
    if (filters.status === "open" && task.status === "done") return false;
    if (filters.status === "done" && task.status !== "done") return false;
    if (filters.status === "overdue" && !(task.status !== "done" && task.dueDate && isPast(task.dueDate))) return false;
    if (filters.due === "today" && task.dueDate !== todayISO()) return false;
    if (filters.due === "week") {
      const limit = addDays(todayISO(), 7);
      if (!task.dueDate || task.dueDate > limit) return false;
    }
    return true;
  }).sort(byDue);

  results.projects = getProjects().filter((p) => matches(`${p.name} ${p.description} ${p.notes}`));
  results.goals = getGoals().filter((g) => matches(`${g.title} ${g.description}`));
  results.habits = getHabits().filter((h) => matches(h.name));
  results.notes = getNotes().filter((n) => matches(`${n.title} ${n.body}`));
  results.events = getEvents().filter((e) => matches(`${e.title} ${e.location}`));
  results.tags = getTags().filter((t) => matches(t.name));
  return results;
}

/* ------------------------------------------------- Project / section / tag */
export function createProject(partial = {}) {
  const project = {
    id: uid("proj"),
    name: partial.name || "Untitled project",
    description: partial.description || "",
    color: partial.color || "#5b5bd6",
    icon: partial.icon || "folder",
    deadline: partial.deadline || null,
    members: partial.members || [state.user.id],
    notes: partial.notes || "",
    favorite: false,
    archived: false,
    createdBy: state.user.id,
    createdAt: Date.now(),
    order: state.projects.length,
    ...partial
  };
  state.projects.push(project);
  logActivity(`created project “${project.name}”`, { type: "create", entityId: project.id });
  emit("project:create");
  return project;
}

export function updateProject(id, patch = {}) {
  const project = getProject(id);
  if (!project) return null;
  Object.assign(project, patch);
  emit("project:update");
  return project;
}

export function deleteProject(id) {
  const project = getProject(id);
  if (!project) return null;
  state.projects = state.projects.filter((p) => p.id !== id);
  state.sections = state.sections.filter((s) => s.projectId !== id);
  state.tasks.forEach((task) => {
    if (task.projectId === id) { task.projectId = null; task.sectionId = null; }
  });
  logActivity(`deleted project “${project.name}”`, { type: "delete" });
  emit("project:delete");
  return true;
}

export function archiveProject(id) {
  const project = getProject(id);
  if (!project) return null;
  project.archived = !project.archived;
  emit("project:archive");
  return project;
}

export function toggleProjectFavorite(id) {
  const project = getProject(id);
  if (!project) return null;
  project.favorite = !project.favorite;
  emit("project:favorite");
  return project;
}

export function createSection(projectId, name = "New section") {
  const section = {
    id: uid("sec"), projectId, name, order: getSections(projectId).length, createdAt: Date.now()
  };
  state.sections.push(section);
  emit("section:create");
  return section;
}

export function renameSection(id, name) {
  const section = getSection(id);
  if (!section) return null;
  section.name = name;
  emit("section:update");
  return section;
}

export function deleteSection(id) {
  const section = getSection(id);
  if (!section) return null;
  state.sections = state.sections.filter((s) => s.id !== id);
  state.tasks.forEach((task) => { if (task.sectionId === id) task.sectionId = null; });
  emit("section:delete");
  return true;
}

export function moveSection(id, direction) {
  const section = getSection(id);
  if (!section) return null;
  const siblings = getSections(section.projectId);
  const index = siblings.findIndex((s) => s.id === id);
  const target = siblings[index + direction];
  if (!target) return null;
  const swap = section.order;
  section.order = target.order;
  target.order = swap;
  emit("section:move");
  return true;
}

/* ------------------------------------------------------------ Kanban columns */
export function createColumn(name = "New column") {
  const column = { id: uid("col"), name, order: state.columns.length };
  state.columns.push(column);
  emit("column:create");
  return column;
}

export function renameColumn(id, name) {
  const column = getColumn(id);
  if (!column) return null;
  column.name = name;
  emit("column:update");
  return column;
}

export function deleteColumn(id) {
  if (getColumns().length <= 1) return false;
  const remaining = getColumns().filter((c) => c.id !== id);
  const fallback = remaining[0];
  state.tasks.forEach((task) => { if (task.columnId === id) task.columnId = fallback.id; });
  state.columns = state.columns.filter((c) => c.id !== id);
  state.columns.forEach((column, index) => { column.order = index; });
  emit("column:delete");
  return true;
}

export function moveColumn(id, direction) {
  const column = getColumn(id);
  if (!column) return null;
  const ordered = getColumns();
  const index = ordered.findIndex((c) => c.id === id);
  const target = ordered[index + direction];
  if (!target) return null;
  const swap = column.order;
  column.order = target.order;
  target.order = swap;
  emit("column:move");
  return true;
}

/* -------------------------------------------------------------------- Tags */
export function createTag(name, color) {
  const clean = String(name || "").trim().replace(/^#/, "");
  if (!clean) return null;
  const existing = getTagByName(clean);
  if (existing) return existing;
  const palette = ["#5b5bd6", "#0f8a83", "#159a63", "#c07409", "#c8437c", "#2f6fd0", "#cf3b45", "#4d5461"];
  const tag = { id: uid("tag"), name: clean, color: color || palette[state.tags.length % palette.length], createdAt: Date.now() };
  state.tags.push(tag);
  emit("tag:create");
  return tag;
}

export function updateTag(id, patch = {}) {
  const tag = getTag(id);
  if (!tag) return null;
  Object.assign(tag, patch);
  emit("tag:update");
  return tag;
}

export function deleteTag(id) {
  state.tags = state.tags.filter((t) => t.id !== id);
  state.tasks.forEach((task) => { task.tagIds = task.tagIds.filter((t) => t !== id); });
  emit("tag:delete");
  return true;
}

/** Resolves tag names to ids, creating tags on the fly (used by NLP quick add). */
export function ensureTags(names = []) {
  return names.map((name) => createTag(name)).filter(Boolean).map((t) => t.id);
}

/* --------------------------------------------------------------- Habits */
export function createHabit(partial = {}) {
  const habit = {
    id: uid("habit"),
    name: partial.name || "New habit",
    description: partial.description || "",
    icon: partial.icon || "spark",
    color: partial.color || "#5b5bd6",
    cadence: partial.cadence || "daily",
    days: partial.days || [0, 1, 2, 3, 4, 5, 6],
    target: partial.target || 1,
    unit: partial.unit || "times",
    reminder: partial.reminder || "",
    streakProtection: partial.streakProtection !== false,
    archived: false,
    createdAt: Date.now(),
    order: state.habits.length
  };
  state.habits.push(habit);
  state.habitLogs[habit.id] = {};
  logActivity(`created habit “${habit.name}”`, { type: "create", entityId: habit.id });
  emit("habit:create");
  return habit;
}

export function updateHabit(id, patch = {}) {
  const habit = getHabit(id);
  if (!habit) return null;
  Object.assign(habit, patch);
  if (patch.cadence && !patch.days) {
    habit.days = patch.cadence === "weekdays" ? [1, 2, 3, 4, 5]
      : patch.cadence === "weekends" ? [0, 6] : [0, 1, 2, 3, 4, 5, 6];
  }
  emit("habit:update");
  return habit;
}

export function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  delete state.habitLogs[id];
  emit("habit:delete");
  return true;
}

export const habitValue = (habitId, date = todayISO()) =>
  Number((state.habitLogs[habitId] || {})[date] || 0);

export function setHabitValue(habitId, date, value) {
  if (!state.habitLogs[habitId]) state.habitLogs[habitId] = {};
  const numeric = Math.max(0, Number(value) || 0);
  if (numeric <= 0) delete state.habitLogs[habitId][date];
  else state.habitLogs[habitId][date] = numeric;
  emit("habit:log");
  return numeric;
}

/** Completes (or clears) a habit for a date. */
export function toggleHabit(habitId, date = todayISO()) {
  const habit = getHabit(habitId);
  if (!habit) return null;
  const current = habitValue(habitId, date);
  const complete = current >= habit.target;
  const next = complete ? 0 : habit.target;
  setHabitValue(habitId, date, next);
  if (next > 0) logActivity(`completed habit “${habit.name}”`, { type: "habit", entityId: habitId });
  return next;
}

export function isHabitScheduled(habit, date) {
  if (!habit || !habit.days) return true;
  return habit.days.includes(parseISO(date).getDay());
}

export function habitStreak(habitId) {
  const habit = getHabit(habitId);
  if (!habit) return { current: 0, best: 0, total: 0 };
  const logs = state.habitLogs[habitId] || {};
  const today = todayISO();

  let current = 0;
  let cursor = (logs[today] || 0) >= habit.target ? today : addDays(today, -1);
  for (let i = 0; i < 400; i += 1) {
    if (!isHabitScheduled(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
    if ((logs[cursor] || 0) >= habit.target) { current += 1; cursor = addDays(cursor, -1); }
    else break;
  }

  const dates = Object.keys(logs).filter((d) => logs[d] >= habit.target).sort();
  let best = 0;
  let run = 0;
  let previous = null;
  dates.forEach((date) => {
    if (previous && diffDays(date, previous) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    previous = date;
  });

  return { current, best, total: dates.length };
}

export function habitCompletion(habitId, days = 30) {
  const habit = getHabit(habitId);
  if (!habit) return { percent: 0, completed: 0, scheduled: 0 };
  const dates = lastNDays(days).filter((date) => isHabitScheduled(habit, date));
  const logs = state.habitLogs[habitId] || {};
  const completed = dates.filter((date) => (logs[date] || 0) >= habit.target).length;
  return { percent: percent(completed, dates.length || 1), completed, scheduled: dates.length };
}

export function habitSeries(habitId, days = 84) {
  const logs = state.habitLogs[habitId] || {};
  const series = {};
  lastNDays(days).forEach((date) => { series[date] = logs[date] || 0; });
  return series;
}

/* ------------------------------------------------------------------ Goals */
export function createGoal(partial = {}) {
  const goal = {
    id: uid("goal"),
    title: partial.title || "New goal",
    description: partial.description || "",
    type: partial.type || "milestone",
    projectId: partial.projectId || null,
    color: partial.color || "#5b5bd6",
    icon: partial.icon || "target",
    target: partial.target || 100,
    current: partial.current || 0,
    unit: partial.unit || "%",
    dueDate: partial.dueDate || addDays(todayISO(), 30),
    status: "active",
    milestones: partial.milestones || [],
    createdAt: Date.now()
  };
  state.goals.push(goal);
  logActivity(`created goal “${goal.title}”`, { type: "create", entityId: goal.id });
  emit("goal:create");
  return goal;
}

export function updateGoal(id, patch = {}) {
  const goal = getGoal(id);
  if (!goal) return null;
  Object.assign(goal, patch);
  emit("goal:update");
  return goal;
}

export function deleteGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  emit("goal:delete");
  return true;
}

export function addMilestone(goalId, title) {
  const goal = getGoal(goalId);
  if (!goal || !title || !title.trim()) return null;
  const milestone = { id: uid("ms"), title: title.trim(), done: false };
  goal.milestones.push(milestone);
  emit("goal:milestone:add");
  return milestone;
}

export function toggleMilestone(goalId, milestoneId) {
  const goal = getGoal(goalId);
  const milestone = goal && goal.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return null;
  milestone.done = !milestone.done;
  emit("goal:milestone:toggle");
  return milestone;
}

export function removeMilestone(goalId, milestoneId) {
  const goal = getGoal(goalId);
  if (!goal) return null;
  goal.milestones = goal.milestones.filter((m) => m.id !== milestoneId);
  emit("goal:milestone:remove");
  return goal;
}

export function setGoalProgress(id, current) {
  const goal = getGoal(id);
  if (!goal) return null;
  goal.current = Math.max(0, Number(current) || 0);
  if (goal.current >= goal.target) goal.status = "completed";
  else if (goal.status === "completed") goal.status = "active";
  emit("goal:progress");
  return goal;
}

export const goalProgress = (goal) => {
  if (!goal) return 0;
  if (goal.type === "metric") return clamp(percent(goal.current, goal.target || 1), 0, 100);
  const total = goal.milestones.length;
  if (!total) return goal.status === "completed" ? 100 : 0;
  return percent(goal.milestones.filter((m) => m.done).length, total);
};

/* ------------------------------------------------------- Notes & folders */
export function createNote(partial = {}) {
  const note = {
    id: uid("note"),
    title: partial.title || "Untitled note",
    body: partial.body || "",
    folderId: partial.folderId || (state.folders[0] ? state.folders[0].id : null),
    pinned: false,
    tags: partial.tags || [],
    checklist: partial.checklist || [],
    linkedTaskId: partial.linkedTaskId || null,
    linkedProjectId: partial.linkedProjectId || null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.notes.unshift(note);
  logActivity(`created note “${note.title}”`, { type: "create", entityId: note.id });
  emit("note:create");
  return note;
}

export function updateNote(id, patch = {}) {
  const note = getNote(id);
  if (!note) return null;
  Object.assign(note, patch, { updatedAt: Date.now() });
  emit("note:update");
  return note;
}

export function deleteNote(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  emit("note:delete");
  return true;
}

export function togglePinNote(id) {
  const note = getNote(id);
  if (!note) return null;
  note.pinned = !note.pinned;
  emit("note:pin");
  return note;
}

export function createFolder(name = "New folder", icon = "folder") {
  const folder = { id: uid("folder"), name, icon };
  state.folders.push(folder);
  emit("folder:create");
  return folder;
}

export function deleteFolder(id) {
  state.folders = state.folders.filter((f) => f.id !== id);
  state.notes.forEach((note) => { if (note.folderId === id) note.folderId = null; });
  emit("folder:delete");
  return true;
}

export function addChecklistItem(noteId, title) {
  const note = getNote(noteId);
  if (!note || !title.trim()) return null;
  const item = { id: uid("ci"), title: title.trim(), done: false };
  note.checklist.push(item);
  note.updatedAt = Date.now();
  emit("note:checklist");
  return item;
}

export function toggleChecklistItem(noteId, itemId) {
  const note = getNote(noteId);
  const item = note && note.checklist.find((i) => i.id === itemId);
  if (!item) return null;
  item.done = !item.done;
  emit("note:checklist");
  return item;
}

/* ---------------------------------------------------------------- Events */
export function createEvent(partial = {}) {
  const event = {
    id: uid("ev"),
    title: partial.title || "New event",
    date: partial.date || todayISO(),
    start: partial.start || "09:00",
    end: partial.end || "10:00",
    location: partial.location || "",
    attendees: partial.attendees || [state.user.id],
    projectId: partial.projectId || null,
    color: partial.color || "#2f6fd0",
    kind: partial.kind || "meeting",
    notes: partial.notes || ""
  };
  state.events.push(event);
  logActivity(`scheduled “${event.title}”`, { type: "create", entityId: event.id });
  emit("event:create");
  return event;
}

export function updateEvent(id, patch = {}) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return null;
  Object.assign(event, patch);
  emit("event:update");
  return event;
}

export function deleteEvent(id) {
  state.events = state.events.filter((e) => e.id !== id);
  emit("event:delete");
  return true;
}

/* ----------------------------------------------------------------- Focus */
export function logFocusSession({ taskId = null, minutes = 25, mode = "pomodoro", label = "", completed = true } = {}) {
  const session = {
    id: uid("fs"),
    mode,
    label: label || (taskId && getTask(taskId) ? getTask(taskId).title : mode),
    taskId,
    minutes,
    completed,
    startedAt: Date.now() - minutes * 60000,
    endedAt: Date.now()
  };
  state.focusSessions.unshift(session);
  if (taskId) {
    const task = getTask(taskId);
    if (task) task.actualMinutes = (task.actualMinutes || 0) + minutes;
  }
  logActivity(`focused for ${minutes} minutes`, { type: "focus", entityId: taskId });
  emit("focus:log");
  return session;
}

export function updateFocusPrefs(patch = {}) {
  state.focus = { ...state.focus, ...patch };
  emit("focus:prefs");
  return state.focus;
}

/* ------------------------------------------------------------------ Team */
export function inviteMember(email, role = "Member") {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return null;
  const member = {
    id: uid("u"),
    name: clean.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    email: clean,
    role,
    color: ["#5b5bd6", "#0f8a83", "#c8437c", "#c07409", "#2f6fd0"][state.team.length % 5]
  };
  state.team.push(member);
  logActivity(`invited ${member.name} as ${role}`, { type: "team", entityId: member.id });
  emit("team:invite");
  return member;
}

export function updateMemberRole(id, role) {
  const member = getMember(id);
  if (!member) return null;
  member.role = role;
  emit("team:role");
  return member;
}

export function removeMember(id) {
  if (id === state.user.id) return false;
  state.team = state.team.filter((m) => m.id !== id);
  emit("team:remove");
  return true;
}

/* ------------------------------------------------- Derived stats/metrics */
export const completedOn = (date) =>
  getAllTasks().filter((t) => t.status === "done" && t.completedAt && toISO(new Date(t.completedAt)) === date).length;

export const createdOn = (date) =>
  getAllTasks().filter((t) => t.createdAt && toISO(new Date(t.createdAt)) === date).length;

export function focusMinutesOn(date) {
  return state.focusSessions
    .filter((s) => s.completed && !String(s.mode).includes("break") && toISO(new Date(s.startedAt)) === date)
    .reduce((acc, s) => acc + s.minutes, 0);
}

export function habitsCompletedOn(date) {
  return getHabits().filter((habit) => isHabitScheduled(habit, date) && habitValue(habit.id, date) >= habit.target).length;
}

export const habitsScheduledOn = (date) => getHabits().filter((habit) => isHabitScheduled(habit, date)).length;

export function dailySeries(days = 14) {
  return lastNDays(days).map((date) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" }),
    short: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    completed: completedOn(date),
    created: createdOn(date),
    focus: focusMinutesOn(date),
    habits: habitsCompletedOn(date)
  }));
}

/** Days in a row (ending today or yesterday) with at least one task completed. */
export function productiveStreak() {
  let current = 0;
  let cursor = completedOn(todayISO()) > 0 ? todayISO() : addDays(todayISO(), -1);
  for (let i = 0; i < 400; i += 1) {
    if (completedOn(cursor) > 0) { current += 1; cursor = addDays(cursor, -1); }
    else break;
  }
  const dates = Array.from(new Set(
    getAllTasks().filter((t) => t.status === "done" && t.completedAt).map((t) => toISO(new Date(t.completedAt)))
  )).sort();
  let best = 0;
  let run = 0;
  let previous = null;
  dates.forEach((date) => {
    if (previous && diffDays(date, previous) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    previous = date;
  });
  return { current, best };
}

/** 0–100 blend of completion, deadlines, focus and habits for a date. */
export function productivityScore(date = todayISO()) {
  const dueToday = getTasks().filter((t) => t.dueDate === date);
  const doneToday = dueToday.filter((t) => t.status === "done").length;
  const overdue = overdueTasks().length;
  const focus = focusMinutesOn(date);
  const habitsScheduled = habitsScheduledOn(date);
  const habitsDone = habitsCompletedOn(date);

  const completionScore = dueToday.length ? (doneToday / dueToday.length) * 60 : (completedOn(date) > 0 ? 48 : 30);
  const focusScore = Math.min(25, (focus / 120) * 25);
  const habitScore = habitsScheduled ? (habitsDone / habitsScheduled) * 15 : 10;
  const penalty = Math.min(18, overdue * 4);
  return clamp(Math.round(completionScore + focusScore + habitScore - penalty), 0, 100);
}

export const scoreTone = (score) =>
  score >= 80 ? "var(--success)" : score >= 55 ? "var(--accent)" : score >= 35 ? "var(--warning)" : "var(--danger)";

export function todayOverview() {
  const date = todayISO();
  const dueToday = getTasks().filter((t) => t.dueDate === date);
  const done = dueToday.filter((t) => t.status === "done").length;
  const streak = productiveStreak();
  return {
    date,
    score: productivityScore(date),
    completedToday: completedOn(date),
    dueToday: dueToday.length,
    doneToday: done,
    remaining: getTasks().filter((t) => t.status !== "done" && t.dueDate === date).length,
    overdue: overdueTasks().length,
    focusMinutes: focusMinutesOn(date),
    habitsDone: habitsCompletedOn(date),
    habitsTotal: habitsScheduledOn(date),
    streak: streak.current,
    bestStreak: streak.best,
    inbox: inboxTasks().length,
    myDay: myDayTasks().length
  };
}

export function weeklySummary() {
  const days = dailySeries(7);
  const completed = sum(days, (d) => d.completed);
  const focus = sum(days, (d) => d.focus);
  const created = sum(days, (d) => d.created);
  const habitDays = days.filter((d) => d.habits > 0).length;
  const prevTotal = sum(lastNDays(14).slice(0, 7), (date) => completedOn(date));
  return {
    days,
    completed,
    focus,
    created,
    habitDays,
    prevTotal,
    delta: prevTotal ? Math.round(((completed - prevTotal) / prevTotal) * 100) : null,
    averagePerDay: Math.round(completed / 7)
  };
}

export function focusStats(days = 7) {
  const sessions = state.focusSessions.filter((s) => diffDays(toISO(new Date(s.startedAt)), todayISO()) >= -days);
  const work = sessions.filter((s) => !String(s.mode).includes("break"));
  const totalMinutes = sum(work, (s) => s.minutes);
  const byDate = {};
  lastNDays(days).forEach((date) => { byDate[date] = 0; });
  work.forEach((s) => {
    const date = toISO(new Date(s.startedAt));
    if (byDate[date] !== undefined) byDate[date] += s.minutes;
  });
  return {
    totalMinutes,
    sessions: work.length,
    average: work.length ? Math.round(totalMinutes / work.length) : 0,
    longest: work.reduce((max, s) => Math.max(max, s.minutes), 0),
    byDate: Object.entries(byDate).map(([date, minutes]) => ({
      date,
      minutes,
      label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })
    })),
    today: focusMinutesOn(todayISO())
  };
}

export function workloadByProject() {
  return getProjects().map((project) => {
    const tasks = tasksByProject(project.id);
    const done = tasks.filter((t) => t.status === "done").length;
    return {
      project,
      total: tasks.length,
      done,
      open: tasks.length - done,
      overdue: tasks.filter((t) => t.status !== "done" && t.dueDate && isPast(t.dueDate)).length,
      progress: percent(done, tasks.length || 1)
    };
  }).sort((a, b) => b.open - a.open);
}

export function priorityBreakdown() {
  const open = getTasks().filter((t) => t.status !== "done");
  return ["urgent", "high", "medium", "low", "none"].map((priority) => ({
    priority,
    count: open.filter((t) => t.priority === priority).length
  }));
}

export function tagBreakdown() {
  return getTags()
    .map((tag) => ({ tag, count: tasksByTag(tag.id).filter((t) => t.status !== "done").length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Small human observations used on the dashboard and analytics views. */
export function insights() {
  const out = [];
  const overview = todayOverview();
  const week = weeklySummary();
  const focus = focusStats(7);

  if (overview.overdue > 0) {
    out.push({
      icon: "alert", tone: "var(--danger)",
      title: `${overview.overdue} overdue ${overview.overdue === 1 ? "task" : "tasks"}`,
      text: "Clearing these first will lift your score fastest."
    });
  } else {
    out.push({
      icon: "check-circle", tone: "var(--success)",
      title: "Nothing overdue", text: "Your deadlines are honest this week — keep it that way."
    });
  }

  const bestDay = [...week.days].sort((a, b) => b.completed - a.completed)[0];
  if (bestDay && bestDay.completed > 0) {
    out.push({
      icon: "trending", tone: "var(--accent)",
      title: `${bestDay.short} was your strongest day`,
      text: `${bestDay.completed} tasks completed with ${bestDay.focus} minutes of focus.`
    });
  }

  if (focus.totalMinutes < 240) {
    out.push({
      icon: "timer", tone: "var(--warning)",
      title: "Protect more deep work",
      text: `Only ${(focus.totalMinutes / 60).toFixed(1)} hours of focus in the last 7 days. Try two 45-minute blocks.`
    });
  } else {
    out.push({
      icon: "timer", tone: "var(--success)",
      title: `${(focus.totalMinutes / 60).toFixed(1)} hours of focus`,
      text: `Averaging ${focus.average} minutes per session this week.`
    });
  }

  const weakestHabit = getHabits()
    .map((habit) => ({ habit, completion: habitCompletion(habit.id, 14) }))
    .sort((a, b) => a.completion.percent - b.completion.percent)[0];
  if (weakestHabit) {
    out.push({
      icon: "repeat", tone: "var(--accent)",
      title: `${weakestHabit.habit.name} needs attention`,
      text: `${weakestHabit.completion.percent}% completion over the last 14 days.`
    });
  }

  if (week.delta !== null) {
    out.push({
      icon: week.delta >= 0 ? "arrow-up-right" : "arrow-right",
      tone: week.delta >= 0 ? "var(--success)" : "var(--danger)",
      title: `${week.delta >= 0 ? "+" : ""}${week.delta}% vs last week`,
      text: `${week.completed} tasks completed this week.`
    });
  }
  return out;
}

/* ------------------------------------------------------------ Reminders */
export function pendingReminders() {
  const now = Date.now();
  const sent = state.reminders.sent || {};
  const out = [];

  if (state.notifications.taskReminders) {
    getTasks().forEach((task) => {
      if (task.status === "done" || !task.dueDate) return;
      if (task.reminder === null || task.reminder === undefined) return;
      const due = new Date(`${task.dueDate}T${task.dueTime || "09:00"}:00`).getTime();
      const fireAt = due - Number(task.reminder) * 60000;
      const key = `task:${task.id}:${fireAt}`;
      if (!sent[key] && now >= fireAt && now - fireAt < 6 * 3600000) {
        out.push({
          key, title: task.title,
          body: `Due ${task.dueTime ? shortTime(task.dueTime) : "today"}`,
          kind: "task", entityId: task.id
        });
      }
    });
  }

  if (state.notifications.deadlineReminders) {
    overdueTasks().forEach((task) => {
      const key = `overdue:${task.id}:${todayISO()}`;
      if (!sent[key]) {
        out.push({ key, title: `Overdue: ${task.title}`, body: "Reschedule or complete it today.", kind: "overdue", entityId: task.id });
      }
    });
  }

  if (state.notifications.habitReminders) {
    const time = nowHHMM();
    getHabits().forEach((habit) => {
      if (!habit.reminder || habit.reminder > time) return;
      if (habitValue(habit.id, todayISO()) >= habit.target) return;
      const key = `habit:${habit.id}:${todayISO()}`;
      if (!sent[key]) {
        out.push({ key, title: `Habit: ${habit.name}`, body: "Still time to keep the streak alive.", kind: "habit", entityId: habit.id });
      }
    });
  }

  if (state.notifications.dailyPlanning) {
    const key = `plan:${todayISO()}`;
    if (state.notifications.dailyPlanningTime <= nowHHMM() && !sent[key]) {
      out.push({ key, title: "Plan your day", body: "Pick your top three and block the time.", kind: "plan" });
    }
  }

  if (state.notifications.weeklySummary) {
    const weekday = new Date().getDay();
    const key = `week:${todayISO()}`;
    if (weekday === Number(state.notifications.weeklySummaryDay) && !sent[key] && nowHHMM() >= "17:00") {
      const week = weeklySummary();
      out.push({
        key, title: "Weekly summary ready",
        body: `${week.completed} tasks completed · ${Math.round(week.focus / 60)}h focus`,
        kind: "summary"
      });
    }
  }

  return out;
}

export function markReminderSent(key) {
  if (!state.reminders.sent) state.reminders.sent = {};
  state.reminders.sent[key] = Date.now();
  const entries = Object.entries(state.reminders.sent).sort((a, b) => b[1] - a[1]).slice(0, 120);
  state.reminders.sent = Object.fromEntries(entries);
  persist();
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function requestDesktopNotifications() {
  if (!notificationsSupported()) return Promise.resolve(false);
  return Notification.requestPermission().then((permission) => permission === "granted");
}

const shortTime = (value) => {
  const [h, m] = String(value).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
};



















