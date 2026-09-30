/* Renders every view against a hydrated store to catch runtime errors. */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tmp = join(root, ".smoke-build");

/* Mirror js/ into .smoke-build with .mjs extensions so Node can import it. */
rmSync(tmp, { recursive: true, force: true });
const mirror = (dir, outDir) => {
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const from = join(dir, name);
    if (statSync(from).isDirectory()) { mirror(from, join(outDir, name)); continue; }
    if (!name.endsWith(".js")) continue;
    const to = join(outDir, name.replace(/\.js$/, ".mjs"));
    writeFileSync(to, readFileSync(from, "utf8").replace(/(from\s+["'])(\.[^"']+?)\.js(["'])/g, "$1$2.mjs$3"));
  }
};
mirror(join(root, "js"), tmp);

const load = (rel) => import(pathToFileURL(join(tmp, rel)).href);

const store = {};
store._data = {};
const memory = {
  _data: store._data,
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};
globalThis.localStorage = memory;

globalThis.document = {
  documentElement: { dataset: {}, style: {} },
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, appendChild() {}, addEventListener() {}, focus() {}
  }),
  head: { appendChild() {} }
};
globalThis.window = {
  location: { hash: "#/dashboard", pathname: "/", search: "" },
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  innerWidth: 1440, innerHeight: 900,
  document: globalThis.document
};
globalThis.navigator = { userAgent: "node" };

const mod = await load("store.mjs");
mod.hydrate();

const VIEWS = [
  ["dashboard", "dashboard", []],
  ["inbox", "tasks", []],
  ["myday", "tasks", []],
  ["today", "tasks", []],
  ["upcoming", "tasks", []],
  ["tasks", "tasks", []],
  ["projects", "tasks", []],
  ["project", "tasks", ["p_product"]],
  ["project-kanban", "tasks", ["p_product", "kanban"]],
  ["calendar", "calendar", []],
  ["focus", "focus", []],
  ["habits", "habits", []],
  ["goals", "goals", []],
  ["notes", "notes", []],
  ["analytics", "analytics", []],
  ["team", "team", []],
  ["settings-appearance", "settings", ["appearance"]],
  ["settings-preferences", "settings", ["preferences"]],
  ["settings-notifications", "settings", ["notifications"]],
  ["settings-data", "settings", ["data"]]
];

const cache = new Map();
let failures = 0;

for (const [label, file, params] of VIEWS) {
  const key = file;
  if (!cache.has(key)) cache.set(key, await load(`views/${file}.mjs`));
  const routes = cache.get(key).routes;
  const entry = routes.find((route) => route.name === label.replace(/^(.*?)-(.*)$/, "$1"));
  if (!entry) {
    console.log(`MISSING  ${label}`);
    failures += 1;
    continue;
  }
  try {
    const html = entry.render(params);
    if (typeof html !== "string" || html.length < 120) {
      console.log(`THIN     ${label} (${String(html && html.length).padStart(6)} chars)`);
      failures += 1;
      continue;
    }
    const suspect = html.match(/.{0,70}(undefined|NaN|\[object Object\]).{0,70}/s);
    if (suspect) {
      console.log(`SUSPECT  ${label}: …${suspect[0].replace(/\s+/g, " ")}…`);
      failures += 1;
      continue;
    }
    console.log(`ok       ${label.padEnd(24)} ${String(html.length).padStart(7)} chars`);
  } catch (error) {
    console.log(`FAIL     ${label}: ${error.message}`);
    failures += 1;
  }
}

console.log(failures ? `\n${failures} failure(s)` : "\nAll views rendered cleanly.");

/* Second pass: call every mount() with a stub root to catch wiring errors. */
const stubRoot = () => ({
  innerHTML: "",
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  closest: () => null,
  appendChild() {},
  remove() {},
  focus() {},
  scrollIntoView() {}
});

let mountFailures = 0;
for (const [label, file, params] of VIEWS) {
  const routes = cache.get(file).routes;
  const entry = routes.find((route) => route.name === label.replace(/^(.*?)-(.*)$/, "$1"));
  if (!entry || typeof entry.mount !== "function") continue;
  let rerenders = 0;
  try {
    entry.mount(stubRoot(), { rerender: () => { rerenders += 1; }, params });
    console.log(`mount   ${label.padEnd(24)} ok${rerenders ? ` (${rerenders} rerender path${rerenders === 1 ? "" : "s"} reachable)` : ""}`);
  } catch (error) {
    console.log(`mount   ${label.padEnd(24)} FAIL ${error.message}`);
    mountFailures += 1;
  }
}

console.log(mountFailures ? `\n${mountFailures} mount failure(s)` : "\nAll mounts wired cleanly.");

/* Third pass: exercise the store flows the views depend on. */
const S = mod;
const U = await import(pathToFileURL(join(tmp, "utils.mjs")).href);
let flowFailures = 0;
const assert = (label, condition, detail = "") => {
  if (condition) console.log(`flow    ${label.padEnd(32)} ok`);
  else { console.log(`flow    ${label.padEnd(32)} FAIL ${detail}`); flowFailures += 1; }
};

const before = S.getTasks().length;
const created = S.createTask({ title: "Smoke test task", priority: "high", dueDate: U.todayISO() });
assert("createTask adds a task", S.getTasks().length === before + 1);
assert("createTask returns the task", Boolean(S.getTask(created.id)));

S.updateTask(created.id, { title: "Renamed task" });
assert("updateTask persists", S.getTask(created.id).title === "Renamed task");
S.toggleTask(created.id);
assert("toggleTask completes", S.getTask(created.id).status === "done");
S.toggleTask(created.id);
assert("toggleTask reopens", S.getTask(created.id).status !== "done");

S.setMyDay(created.id, true);
assert("setMyDay adds to My Day", S.getTask(created.id).myDay === true);
S.setMyDay(created.id, false);
S.setPriority(created.id, "urgent");
assert("setPriority", S.getTask(created.id).priority === "urgent");

S.addSubtask(created.id, "Step one");
const subId = S.getTask(created.id).subtasks[0].id;
S.toggleSubtask(created.id, subId);
assert("addSubtask / toggleSubtask", S.getTask(created.id).subtasks[0].done === true);
S.removeSubtask(created.id, subId);
assert("removeSubtask", S.getTask(created.id).subtasks.length === 0);

S.addComment(created.id, "Looks good", "u_tunde");
assert("addComment", S.getTask(created.id).comments.length === 1);
S.rescheduleTask(created.id, U.addDays(U.todayISO(), 3));
assert("rescheduleTask", S.getTask(created.id).dueDate === U.addDays(U.todayISO(), 3));
S.snoozeTask(created.id, 1);
assert("snoozeTask marks snoozed", Boolean(S.getTask(created.id).snoozedUntil));
S.setTimeBlock(created.id, { date: U.todayISO(), start: "09:00", end: "10:30" });
assert("setTimeBlock", Boolean(S.getTask(created.id).timeBlock));
S.bulkUpdate([created.id], { priority: "low" });
assert("bulkUpdate", S.getTask(created.id).priority === "low");
S.archiveTask(created.id);
assert("archiveTask", S.getTask(created.id).archived === true);
S.restoreTask(created.id);
assert("restoreTask", S.getTask(created.id).archived === false);
S.duplicateTask(created.id);
assert("duplicateTask", S.getTasks().length === before + 2);
S.deleteTask(created.id);
assert("deleteTask", S.getTasks().length === before + 1);

/* Fourth pass: derived stats, habits, goals, notes, events, team, NLP, persistence. */
const today = U.todayISO();
const o = S.todayOverview();
assert("todayOverview score", typeof o.score === "number" && o.score >= 0 && o.score <= 100, String(o.score));
assert("weeklySummary 7 days", S.weeklySummary().days.length === 7);
assert("insights array", Array.isArray(S.insights()) && S.insights().length > 0);
assert("focusStats minutes", typeof S.focusStats(7).totalMinutes === "number");
assert("dailySeries 14 days", S.dailySeries(14).length === 14);
assert("productiveStreak shape", "current" in S.productiveStreak());
assert("groupTasks groups", Array.isArray(S.groupTasks(S.getTasks(), "date")));
assert("myTasksView filters", Array.isArray(S.myTasksView()));
assert("searchAll buckets", Array.isArray(S.searchAll("a").tasks));
assert("workloadByProject rows", Array.isArray(S.workloadByProject()));
assert("priorityBreakdown 5", S.priorityBreakdown().length === 5);
assert("tagBreakdown rows", Array.isArray(S.tagBreakdown()));
assert("tasksDueOn array", Array.isArray(S.tasksDueOn(today)));
assert("tasksWithBlocks array", Array.isArray(S.tasksWithBlocks(today)));
assert("getEventsForDate array", Array.isArray(S.getEventsForDate(today)));
assert("pendingReminders array", Array.isArray(S.pendingReminders()));
assert("inbox/myDay/today/upcoming", [S.inboxTasks(), S.myDayTasks(), S.todayTasks(), S.upcomingTasks(7)].every(Array.isArray));

const habit = S.getHabits()[0] || S.createHabit({ name: "Smoke habit", target: 1 });
const logged = S.toggleHabit(habit.id);
assert("toggleHabit logs check-in", logged > 0, String(logged));
S.toggleHabit(habit.id);
assert("habitValue clears", S.habitValue(habit.id, today) === 0);
assert("habitStreak shape", "current" in S.habitStreak(habit.id));
assert("habitCompletion shape", "percent" in S.habitCompletion(habit.id));
assert("habitSeries map", typeof S.habitSeries(habit.id) === "object");

const goal = S.getGoals()[0] || S.createGoal({ title: "Smoke goal" });
assert("goalProgress percent", typeof S.goalProgress(goal) === "number");
S.addMilestone(goal.id, "Smoke milestone");
const miles = S.getGoal(goal.id).milestones;
S.toggleMilestone(goal.id, miles[miles.length - 1].id);
assert("milestone toggles", S.getGoal(goal.id).milestones[miles.length - 1].done === true);
S.setGoalProgress(goal.id, 3);
assert("setGoalProgress", S.getGoal(goal.id).current === 3);

const note = S.createNote({ title: "Smoke note", body: "Body" });
S.updateNote(note.id, { body: "Updated" });
assert("createNote / updateNote", S.getNote(note.id).body === "Updated");
S.togglePinNote(note.id);
assert("togglePinNote", S.getNote(note.id).pinned === true);
S.addChecklistItem(note.id, "Check");
assert("addChecklistItem", S.getNote(note.id).checklist.length === 1);
S.deleteNote(note.id);
assert("deleteNote", S.getNote(note.id) === null);

const folder = S.createFolder("Smoke folder");
S.deleteFolder(folder.id);
assert("createFolder / deleteFolder", S.getFolders().every((f) => f.id !== folder.id));

const ev = S.createEvent({ title: "Smoke event", date: today, start: "10:00", end: "11:00" });
S.updateEvent(ev.id, { title: "Renamed event" });
assert("createEvent / updateEvent", S.getEventsForDate(today).some((e) => e.id === ev.id && e.title === "Renamed event"));
S.deleteEvent(ev.id);
assert("deleteEvent", !S.getEventsForDate(today).some((e) => e.id === ev.id));

const project = S.createProject({ name: "Smoke project" });
S.updateProject(project.id, { description: "Updated" });
assert("createProject / updateProject", S.getProject(project.id).description === "Updated");
S.toggleProjectFavorite(project.id);
assert("toggleProjectFavorite", S.getProject(project.id).favorite === true);
S.deleteProject(project.id);
assert("deleteProject", S.getProject(project.id) === null);

const member = S.inviteMember("smoke@elevate.app", "Member");
assert("inviteMember", Boolean(member) && member.email === "smoke@elevate.app");
S.updateMemberRole(member.id, "Admin");
assert("updateMemberRole", S.getMember(member.id).role === "Admin");
assert("removeMember protects owner", S.removeMember(S.currentUser().id) === false);
S.removeMember(member.id);
assert("removeMember", S.getMember(member.id) === null);

const sessions = S.getFocusSessions().length;
S.logFocusSession({ minutes: 25, mode: "pomodoro", label: "Smoke" });
assert("logFocusSession", S.getFocusSessions().length === sessions + 1);

const nlp = await import(pathToFileURL(join(tmp, "nlp.mjs")).href);
const parsed = nlp.parseTaskInput("Call the dentist tomorrow at 3pm !urgent #work");
assert("nlp parses a title", Boolean(parsed.title && parsed.title.length), JSON.stringify(parsed).slice(0, 90));
assert("nlp parses priority", typeof parsed.priority === "string", String(parsed.priority));
assert("nlp describe works", typeof nlp.describe(parsed) === "string");

const json = S.exportState();
assert("exportState returns JSON", json.startsWith("{") && json.includes("tasks"));
S.importState(json);
assert("importState round-trips", S.getTasks().length > 0);

S.markReminderSent("smoke:key");
assert("markReminderSent records", Boolean(S.getState().reminders.sent["smoke:key"]));
S.updateUi({ theme: "dark" });
assert("updateUi persists", S.getUi().theme === "dark");
S.updateUi({ theme: "light" });
assert("charts render", typeof (await import(pathToFileURL(join(tmp, "charts.mjs")).href)).barChart([{ label: "a", value: 1 }]) === "string");

/* The workspace starts empty; sample data is opt-in and fully reversible. */
assert("starts with no sample data", S.hasSampleData() === false);
S.setSampleData(true);
assert("sample data loads tasks", S.getTasks().length > 0, `${S.getTasks().length} tasks`);
assert("sample data loads projects", S.getProjects().length > 0);
assert("sample data flag set", S.hasSampleData() === true);
S.setSampleData(false);
assert("sample data clears tasks", S.getTasks().length === 0, `${S.getTasks().length} left`);
assert("sample data clears projects", S.getProjects().length === 0);
assert("sample data clears habits/goals/notes", S.getHabits().length === 0 && S.getGoals().length === 0 && S.getNotes().length === 0);
assert("board keeps its lanes", S.getColumns().length === 3, `${S.getColumns().length} columns`);
assert("folders survive clearing", S.getFolders().length > 0);
S.setSampleData(true);
assert("sample data can be re-enabled", S.getTasks().length > 0);

console.log(flowFailures ? `\n${flowFailures} flow failure(s)` : "\nAll store flows passed.");

/* Fifth pass: boot the real app shell against a DOM stub. */
const listeners = { window: {}, document: {} };
const el = (id = "") => {
  let html = "";
  const node = {
    id,
    textContent: "",
    hidden: false,
    value: "",
    dataset: {},
    style: {},
    children: [],
    className: "",
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    /* Setting innerHTML replaces content, so the children list is cleared too. */
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); if (value === "") node.children = []; },
    addEventListener(type, fn) { (listeners.window[type] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
    appendChild(c) { node.children.push(c); return c; },
    removeChild() {},
    remove() { node.removed = true; },
    focus() {},
    blur() {},
    click() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  };
  return node;
};

const nodes = new Map();
const byId = (id) => {
  if (!nodes.has(id)) nodes.set(id, el(id));
  return nodes.get(id);
};

globalThis.document = {
  documentElement: { dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
  body: el("body"),
  head: { appendChild() {} },
  addEventListener(type, fn) { (listeners.document[type] ||= []).push(fn); },
  querySelector: (sel) => byId(sel.replace(/^#/, "")),
  querySelectorAll: () => [],
  createElement: () => el(),
  createDocumentFragment: () => el(),
  getElementById: (id) => byId(id)
};

globalThis.window = {
  location: { hash: "#/dashboard", pathname: "/", search: "", href: "http://localhost/#/dashboard" },
  addEventListener(type, fn) { (listeners.window[type] ||= []).push(fn); },
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1440, innerHeight: 900, scrollY: 0,
  scrollTo() {},
  getComputedStyle: () => ({}),
  requestAnimationFrame: (fn) => { fn(); return 0; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: globalThis.document
};
globalThis.getComputedStyle = () => ({});
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.location = globalThis.window.location;

let appFailures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`app     ${label.padEnd(34)} ok`);
  else { console.log(`app     ${label.padEnd(34)} FAIL ${detail}`); appFailures += 1; }
};

try {
  await import(pathToFileURL(join(tmp, "app.mjs")).href);
  check("app module boots", true);
} catch (error) {
  check("app module boots", false, error.message);
}

const appNode = byId("app");
const sidebar = byId("sidebar");
const view = byId("view");
const topbar = byId("topbar");
const boot = byId("boot");

/* The view host now delegates to a throwaway stage child each render. */
const viewHtml = () => {
  const stage = view.children[view.children.length - 1];
  return stage ? stage.innerHTML : view.innerHTML;
};

check("app shell is visible", appNode.hidden === false);
check("boot splash removed", boot.removed === true);
check("sidebar rendered nav", sidebar.innerHTML.includes("Dashboard") && sidebar.innerHTML.includes("nav-item"));
check("topbar rendered", topbar.innerHTML.includes("topbar__title"));
check("dashboard rendered", viewHtml().includes("hero__greet") || viewHtml().includes("Productivity"), viewHtml().slice(0, 80));

const fire = (type, detail = {}) => (listeners.window[type] || []).forEach((fn) => fn({ preventDefault() {}, stopPropagation() {}, ...detail }));
const go = (hash) => {
  window.location.hash = hash;
  fire("hashchange");
};

go("#/tasks");
check("route: tasks", viewHtml().includes("All tasks"), viewHtml().slice(0, 60));
go("#/calendar");
check("route: calendar", viewHtml().includes("cal-toolbar"));
go("#/habits");
check("route: habits", viewHtml().includes("Habits"));
go("#/goals");
check("route: goals", viewHtml().includes("Goals"));
go("#/notes");
check("route: notes", viewHtml().includes("note-card") || viewHtml().includes("Nothing here yet"), viewHtml().slice(0, 80));
go("#/analytics");
check("route: analytics", viewHtml().includes("chart-grid"));
go("#/focus");
check("route: focus", viewHtml().includes("focus-sounds"));
go("#/team");
check("route: team", viewHtml().includes("member-row"));
go("#/settings/appearance");
check("route: settings sub-section", viewHtml().includes("settings-panel") && viewHtml().includes("theme-preview"));
go("#/settings/data");
check("route: settings data", viewHtml().includes("sampleData"), "sample-data toggle missing");
check("removed: no AI section", !viewHtml().includes("AI assistant"));
check("removed: no integrations", !viewHtml().includes("Connected apps"));
check("removed: no plans", !viewHtml().includes("plan-box"));
go("#/projects");
check("route: projects", viewHtml().includes("No projects") || viewHtml().includes("project-card"));
go("#/nonexistent-page");
check("unknown route falls back", viewHtml().includes("Page not found") || viewHtml().includes("Something went wrong"));
go("#/dashboard");
check("returns to dashboard", viewHtml().includes("hero"));

/* Re-rendering the same view must not stack listeners (the duplicate-toast bug). */
const stageCountBefore = view.children.length;
fire("hashchange");
check("renders do not accumulate stages", view.children.length === stageCountBefore, `${view.children.length} stages`);
check("sidebar hides All tasks", !sidebar.innerHTML.includes(">All tasks<"));
check("sidebar hides Inbox", !sidebar.innerHTML.includes(">Inbox<"));
check("sidebar hides My Day", !sidebar.innerHTML.includes(">My Day<"));
check("sidebar hides Today", !sidebar.innerHTML.includes(">Today<"));
check("sidebar hides Upcoming", !sidebar.innerHTML.includes(">Upcoming<"));
check("sidebar hides Goals", !sidebar.innerHTML.includes(">Goals<"));
check("sidebar has no Projects heading", !sidebar.innerHTML.includes(">Projects</div>\n          <button"), !sidebar.innerHTML.includes(">All projects<"));
check("sidebar keeps Organise Projects link", sidebar.innerHTML.includes(">Projects<"));
check("sidebar keeps Focus", sidebar.innerHTML.includes(">Focus<"));
check("Plan group is dashboard only", (() => {
  const m = sidebar.innerHTML.match(/<div class="nav-group__label">Plan<\/div>[\s\S]*?<\/div>/);
  return Boolean(m) && m[0].includes("Dashboard") && !m[0].includes("My Day") && !m[0].includes(">Today<") && !m[0].includes("Upcoming");
})());
check("no plan-my-day button", !viewHtml().includes("plan-day"));
check("no habit progress card", !viewHtml().includes("Habit progress"));
check("no insights card", !viewHtml().includes("What Elevate noticed"));
check("upcoming deadlines present", viewHtml().includes("Upcoming deadlines"));
check("compact stat strip used", viewHtml().includes("stat-strip") && !viewHtml().includes("stat__value"));
check("My Day and schedule side by side", viewHtml().includes("dash-grid--even"));
check("focus notice shown", viewHtml().includes("focus-notice") && viewHtml().includes("Focus mode"));
check("greeting has no user name", !/Good (morning|afternoon|evening), [A-Z][a-z]+/.test(viewHtml()));
check("greeting is motivational", /Good (morning|afternoon|evening), (you|small|the|your|today|steady|every|progress)/i.test(viewHtml()));

/* The greeting must be able to vary between loads. */
const Utils = await import(pathToFileURL(join(tmp, "utils.mjs")).href);
const lines = new Set(Array.from({ length: 60 }, () => Utils.motivation()));
check("motivation varies between loads", lines.size > 1, `${lines.size} distinct of 60`);
check("motivation never blank", [...lines].every((line) => typeof line === "string" && line.length > 8));

/* The focus notice disappears once dismissed, and the dismissal persists. */
S.updateUi({ dismissedHints: ["focus-notice"] });
check("dismissal persists in state", S.getUi().dismissedHints.includes("focus-notice"));
const afterDismiss = cache.get("dashboard").routes.find((r) => r.name === "dashboard").render([]);
check("focus notice hidden after dismiss", !afterDismiss.includes("focus-notice"));
S.updateUi({ dismissedHints: [] });
const restored = cache.get("dashboard").routes.find((r) => r.name === "dashboard").render([]);
check("focus notice returns when reset", restored.includes("focus-notice"));

/* Profile section and the sidebar identity chip are gone. */
const settingsView = await import(pathToFileURL(join(tmp, "views/settings.mjs")).href);
const settingsRoute = settingsView.routes.find((r) => r.name === "settings");
const settingsHtml = settingsRoute.render(["appearance"]);
check("no Profile section", !settingsHtml.includes(">Profile<") && !settingsHtml.includes("st-name") && !settingsHtml.includes("st-email"));
check("no bio field", !settingsHtml.includes("st-bio"));
check("no save-profile button", !settingsHtml.includes("save-profile"));
check("no avatar picker", !settingsHtml.includes("avatar-color"));
check("settings defaults to appearance", settingsRoute.render([]).includes("theme-preview"));
check("unknown settings section falls back", settingsRoute.render(["profile"]).includes("theme-preview"));
check("sidebar has no identity chip", !sidebar.innerHTML.includes("sidebar__user") && !sidebar.innerHTML.includes("sidebar__foot"));
check("topbar has no user name/email", !byId("topbar").innerHTML.includes("Local workspace") && !byId("topbar").innerHTML.includes("sidebar__user-name"));
check("no email anywhere in chrome", !sidebar.innerHTML.includes("@") && !byId("topbar").innerHTML.includes("@"));
check("settings still reachable", settingsHtml.includes("settings-panel"));

/* Onboarding is gone: no gate on boot, no menu entry, no state flag. */
check("no onboarding state flag", S.getState().onboarded === undefined, JSON.stringify(S.getState().onboarded));
check("no onboarding menu entry", !byId("topbar").innerHTML.includes("onboarding") && !sidebar.innerHTML.includes("onboarding"));
const shellHtml = (await import("node:fs")).readFileSync(join(root, "index.html"), "utf8");
check("no onboarding mount point in shell", !shellHtml.includes('id="onboarding"'));
const viewsCss = (await import("node:fs")).readFileSync(join(root, "styles/views.css"), "utf8");
check("no onboarding css", !viewsCss.includes(".onb"));

/* Typography refresh + pointer glow. */
check("font link carries both families", shellHtml.includes("Plus+Jakarta+Sans") && shellHtml.includes("Fraunces"));
check("no Inter left in the shell", !shellHtml.includes("family=Inter"));
const tokensCss = (await import("node:fs")).readFileSync(join(root, "styles/tokens.css"), "utf8");
check("--font is Plus Jakarta", /--font:\s*"Plus Jakarta Sans"/.test(tokensCss));
check("--font-display token exists", tokensCss.includes('--font-display: "Fraunces"'));
const baseCss = (await import("node:fs")).readFileSync(join(root, "styles/base.css"), "utf8");
check("display face mapped to titles", baseCss.includes(".hero__greet") && baseCss.includes("var(--font-display)"));
check("serif can be switched off", baseCss.includes('html[data-fonts="sans"]'));
check("glow layer declared", baseCss.includes(".cursor-trail") && baseCss.includes("pointer-events: none"));
check("glow honours reduced motion", /@media \(prefers-reduced-motion: reduce\) \{ \.cursor-trail/.test(baseCss));
check("glow sits under overlays", /--z-cursor:\s*(\d+)/.exec(tokensCss)[1] < 60);
check("appearance offers both toggles", settingsHtml.includes("displayFonts") && settingsHtml.includes("cursorTrail"));
check("dead reduce-motion toggle stays gone", !settingsHtml.includes("reduceMotion"));

/* The trail must be inert where it should not run, and never throw. */
const { createCursorTrail } = await import(pathToFileURL(join(tmp, "cursor.mjs")).href);
const trail = createCursorTrail();
check("trail API is safe without a canvas", typeof trail.setEnabled === "function" && trail.enabled === false);
trail.setEnabled(true);
check("trail stays off without a 2d context", trail.enabled === false);
trail.destroy();
check("destroy is safe", true);

/* Sample data: the dashboard toggle must really load and clear the workspace. */
const dashRoute = cache.get("dashboard").routes.find((r) => r.name === "dashboard");
S.clearAllData();
S.setSampleData(false);
const emptyDash = dashRoute.render([]);
check("sample switch rendered off", emptyDash.includes('data-act="sample-data"') && emptyDash.includes('aria-checked="false"'));
check("empty dashboard offers sample data", emptyDash.includes("Load sample data"));
const clickHandlers = (listeners.window.click || []).slice();
/* A realistic event: the node answers [data-act] and nothing else, so every
   other view's handler takes its normal "not my action" path. */
const fakeBtn = { dataset: { act: "sample-data" }, closest: (sel) => (sel === "[data-act]" ? fakeBtn : null) };
let threw = 0;
for (const fn of clickHandlers) {
  try { fn({ target: fakeBtn, pointerType: "mouse" }); } catch { threw += 1; }
}
check("no handler throws on the click", threw === 0, `${threw} threw`);
check("clicking the switch loads sample data", S.hasSampleData() && S.getTasks().length > 0, `${S.getTasks().length} tasks`);
const onDash = dashRoute.render([]);
check("sample switch rendered on", onDash.includes('aria-checked="true"') && !onDash.includes("Load sample data"));
const dashSrc = readFileSync(join(root, "js/views/dashboard.js"), "utf8");
check("clearing asks for confirmation", /case "sample-data"[\s\S]*confirmDialog/.test(dashSrc));
S.setSampleData(false);
const clearedDash = dashRoute.render([]);
check("switch back off when cleared", clearedDash.includes('aria-checked="false"') && S.getTasks().length === 0);



console.log(appFailures ? `\n${appFailures} app failure(s)` : "\nApp shell verified.");
rmSync(tmp, { recursive: true, force: true });
process.exit(failures + mountFailures + flowFailures + appFailures ? 1 : 0);
