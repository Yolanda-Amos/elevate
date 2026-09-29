/* ==========================================================================
   Elevate — App shell: hydration, routing, chrome, palette and reminders
   ========================================================================== */
import { $, $$, escapeHtml, todayISO, formatDate, debounce, isMobile, modKey } from "./utils.js";
import { icon, brandMark } from "./icons.js";
import { toast, menu, closeAllOverlays, closeTopOverlay, modal } from "./ui.js";
import { register, start, navigate, current, getRoute } from "./router.js";
import {
  hydrate, subscribe, getUi, inboxTasks,
  overdueTasks, openTaskCount, searchAll, pendingReminders,
  markReminderSent, notificationsSupported, todayOverview, getNotifications, toggleSidebar
} from "./store.js";
import { openQuickAdd } from "./taskform.js";
import { routes as dashboardRoutes } from "./views/dashboard.js";
import { routes as taskRoutes } from "./views/tasks.js";
import { routes as calendarRoutes } from "./views/calendar.js";
import { routes as focusRoutes } from "./views/focus.js";
import { routes as habitRoutes } from "./views/habits.js";
import { routes as goalRoutes } from "./views/goals.js";
import { routes as noteRoutes } from "./views/notes.js";
import { routes as analyticsRoutes } from "./views/analytics.js";
import { routes as settingsRoutes } from "./views/settings.js";
import { routes as teamRoutes } from "./views/team.js";
import { startOnboarding, onboarded } from "./views/onboarding.js";

const ALL_ROUTES = [
  ...dashboardRoutes, ...taskRoutes, ...calendarRoutes, ...focusRoutes,
  ...habitRoutes, ...goalRoutes, ...noteRoutes, ...analyticsRoutes, ...teamRoutes, ...settingsRoutes
];
ALL_ROUTES.forEach((route) => register(route.name, route));

const NAV_GROUPS = ["Plan", "Organise", "Focus", "Grow", "Insights", "Workspace"];
const GROUP_ORDER = { Plan: 0, Organise: 1, Focus: 2, Grow: 3, Insights: 4, Workspace: 5 };
const MOBILE_ROUTES = ["dashboard", "projects", "calendar", "focus", "habits", "notes", "analytics", "settings"];

const dom = {
  app: $("#app"),
  sidebar: $("#sidebar"),
  topbar: $("#topbar"),
  view: $("#view"),
  bottomnav: $("#bottomnav"),
  fab: $("#fab"),
  boot: $("#boot")
};

let activeRoute = { name: "dashboard", params: [] };

/* --------------------------------------------------------------- Nav counts */
const counts = () => ({
  overdue: overdueTasks().length,
  tasks: openTaskCount()
});

const badgeFor = (name, map) => {
  if (!(name in map)) return "";
  const value = map[name];
  if (!value) return "";
  const alert = name === "inbox" || name === "overdue";
  return `<span class="nav-item__count${alert ? " is-alert" : ""}">${value > 99 ? "99+" : value}</span>`;
};

/* --------------------------------------------------------------- Sidebar */
function renderSidebar() {
  const map = counts();
  const activeName = activeRoute.name;

  const groups = NAV_GROUPS.map((group) => ({
    group,
    items: ALL_ROUTES.filter((route) => route.nav && route.group === group)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  })).filter((entry) => entry.items.length);

  const openCount = openTaskCount();
  const inbox = inboxTasks().length;

  dom.sidebar.innerHTML = `
    <div class="brand">
      <span class="brand__mark">${brandMark(18)}</span>
      <span class="brand__text">
        <span class="brand__name">Elevate</span>
        <span class="brand__sub">Calm productivity</span>
      </span>
    </div>

    <button class="nav-search" type="button" data-act="palette">
      ${icon("search", 15)}<span>Search or jump to…</span><kbd class="kbd">${modKey}K</kbd>
    </button>

    <div class="nav-scroll">
      ${groups.map(({ group, items }) => `
        <div class="nav-group">
          <div class="nav-group__label">${escapeHtml(group)}</div>
          ${items.map((route) => `
            <button class="nav-item${activeName === route.name ? " is-active" : ""}" type="button" data-route="${route.name}"
              ${activeName === route.name ? 'aria-current="page"' : ""}>
              ${icon(route.icon || "circle", 16)}
              <span class="nav-item__label">${escapeHtml(route.title)}</span>
              ${badgeFor(route.name, map)}
            </button>`).join("")}
        </div>`).join("")}

      <div class="plan-card">
        <div class="plan-card__title">Your day</div>
        <div class="plan-card__body">${openCount} open ${openCount === 1 ? "task" : "tasks"} · ${inbox ? `${inbox} untriaged` : "inbox clear"}</div>
        <button class="btn btn--soft btn--sm btn--block" type="button" data-route="focus">
          ${icon("timer", 14)} Start a focus session
        </button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- Topbar */
function renderTopbar() {
  const route = getRoute(activeRoute.name);
  const overview = todayOverview();
  const isCalendar = activeRoute.name === "calendar";

  dom.topbar.innerHTML = `
    <button class="icon-btn hide-mobile" type="button" data-act="toggle-sidebar" aria-label="Toggle sidebar">${icon("layout", 17)}</button>
    <button class="icon-btn show-mobile" type="button" data-act="open-nav" aria-label="Open menu">${icon("list", 18)}</button>
    <span class="topbar__title">${escapeHtml(route ? route.title : "Elevate")}</span>
    ${activeRoute.params.length ? `<span class="topbar__crumb">/ ${escapeHtml(activeRoute.params.map(decodeURIComponent).join(" / "))}</span>` : ""}
    <span class="topbar__spacer"></span>
    ${isCalendar ? `<span class="topbar__crumb">${escapeHtml(formatDate(todayISO(), "long"))}</span>` : ""}
    <button class="icon-btn" type="button" data-act="search" data-tip="Search ${modKey}K">${icon("search", 17)}</button>
    <button class="icon-btn" type="button" data-act="quick-add" data-tip="Quick add (Q)">${icon("plus", 17)}</button>
    ${overview.overdue ? `<button class="btn btn--soft btn--sm hide-mobile" type="button" data-act="show-overdue">${icon("alert", 14)} ${overview.overdue} overdue</button>` : ""}
    <button class="icon-btn" type="button" data-act="user-menu" data-tip="Menu">${icon("more-h", 17)}</button>`;
}

/* ------------------------------------------------------------ Mobile nav */
function renderBottomNav() {
  const items = MOBILE_ROUTES
    .map((name) => getRoute(name))
    .filter(Boolean)
    .slice(0, 5);
  dom.bottomnav.innerHTML = items.map((route) => `
    <button class="bottomnav__item${activeRoute.name === route.name ? " is-active" : ""}" type="button" data-route="${route.name}">
      ${icon(route.icon || "circle", 19)}
      <span>${escapeHtml(route.title.split(" ")[0])}</span>
    </button>`).join("");
  dom.bottomnav.hidden = !isMobile();
  dom.fab.hidden = !isMobile();
  renderScrim();
}

/** Tapping outside the drawer closes it on mobile. */
function renderScrim() {
  let scrim = $(".scrim", dom.app);
  const open = dom.app.classList.contains("nav-open") && isMobile();
  if (!open) {
    if (scrim) scrim.remove();
    return;
  }
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.dataset.act = "close-nav";
    dom.app.appendChild(scrim);
  }
}

/* ---------------------------------------------------------- View renderer */
/* `soft` re-renders keep open overlays (modals, drawers) alive — used when a
   view repaints itself after a local change, so typing is never interrupted. */
const rerender = () => renderView(activeRoute, { keepScroll: true, soft: true });

function renderView(route, { keepScroll = false, soft = false } = {}) {
  const scrollY = keepScroll ? window.scrollY : 0;
  const definition = getRoute(route.name);
  activeRoute = route;

  /* Each render mounts into a *fresh* child node. Views attach their listeners
     to the node they are given, so discarding the old node discards its
     listeners too — otherwise they stack up and one click fires N times. */
  dom.view.innerHTML = "";
  const stage = document.createElement("div");
  stage.className = "view__stage";
  dom.view.appendChild(stage);

  if (!definition) {
    stage.innerHTML = `<div class="empty"><div class="empty__title">Page not found</div>
      <p class="empty__text">The route “${escapeHtml(route.name)}” does not exist.</p></div>`;
    renderChrome();
    return;
  }

  if (!soft) closeAllOverlays();
  try {
    stage.innerHTML = definition.render(route.params) || "";
  } catch (error) {
    console.error("Elevate: view render failed", error);
    stage.innerHTML = `<div class="empty"><div class="empty__title">Something went wrong</div>
      <p class="empty__text">This view failed to render. ${escapeHtml(error.message)}</p></div>`;
  }

  if (typeof definition.mount === "function") {
    try {
      definition.mount(stage, { rerender, params: route.params });
    } catch (error) {
      console.error("Elevate: view mount failed", error);
    }
  }
  window.scrollTo({ top: scrollY });
  renderChrome();
}

function renderChrome() {
  renderSidebar();
  renderTopbar();
  renderBottomNav();
  document.title = `${(getRoute(activeRoute.name) || {}).title || "Elevate"} · Elevate`;
}

/* --------------------------------------------------------- Command palette */
const PALETTE_HINTS = [
  { icon: "search", keys: `${modKey} K`, label: "Open palette" },
  { icon: "plus", keys: "Q", label: "Quick add" },
  { icon: "timer", keys: "F", label: "Focus mode" },
  { icon: "inbox", keys: "G then I", label: "Inbox" }
];

const paletteItem = ({ iconName, title, sub, active }) => `
  <button class="palette__item${active ? " is-active" : ""}" type="button" data-palette-index>
    <span class="palette__item-icon">${icon(iconName, 15)}</span>
    <span class="palette__item-main">
      <span class="palette__item-title truncate">${escapeHtml(title)}</span>
      ${sub ? `<span class="palette__item-sub truncate">${escapeHtml(sub)}</span>` : ""}
    </span>
  </button>`;

function openPalette(initial = "") {
  let query = initial;
  let activeIndex = 0;
  let results = [];

  const build = () => {
    const found = searchAll(query);
    const items = [];

    if (query.trim()) {
      found.tasks.slice(0, 6).forEach((task) => {
        const project = getAllProjects().find((item) => item.id === task.projectId);
        items.push({
          iconName: "check-circle", title: task.title,
          sub: [project ? project.name : "Inbox", task.dueDate].filter(Boolean).join(" · "),
          action: () => navigate("tasks")
        });
      });
      found.projects.slice(0, 3).forEach((project) => items.push({
        iconName: "folder", title: project.name, sub: "Project",
        action: () => navigate("project", project.id)
      }));
      found.notes.slice(0, 3).forEach((note) => items.push({ iconName: "note", title: note.title, sub: "Note", action: () => navigate("notes") }));
      found.habits.slice(0, 2).forEach((habit) => items.push({ iconName: "repeat", title: habit.name, sub: "Habit", action: () => navigate("habits") }));
      found.goals.slice(0, 2).forEach((goal) => items.push({ iconName: "target", title: goal.title, sub: "Goal", action: () => navigate("goals") }));
    } else {
      ALL_ROUTES.filter((route) => route.nav).slice(0, 7).forEach((route) => items.push({
        iconName: route.icon || "circle", title: `Go to ${route.title}`, sub: "Navigate",
        action: () => navigate(route.name)
      }));
    }

    if (query.trim()) {
      items.unshift(
        { iconName: "plus", title: `Create task “${query.trim()}”`, sub: "Quick add", action: () => openQuickAdd({ defaults: { title: query.trim() }, onSaved: rerender }) },
        { iconName: "timer", title: "Start a focus session", sub: "25 minutes", action: () => navigate("focus") }
      );
    }

    results = items.slice(0, 14);
    activeIndex = 0;
    return results;
  };

  const listHtml = () => (results.length
    ? results.map((item, index) => paletteItem({ ...item, active: index === activeIndex })).join("")
    : `<div class="palette__group">Nothing matched</div>`);

  return modal({
    size: "lg",
    body: `<div class="palette">
      <div class="palette__input-row">
        ${icon("search", 18)}
        <input class="palette__input" id="pal-input" placeholder="Search tasks, projects, notes…" value="${escapeHtml(query)}" autocomplete="off" />
        <button class="icon-btn" type="button" data-overlay-close aria-label="Close">${icon("x", 17)}</button>
      </div>
      <div class="palette__list" id="pal-list">${listHtml(build())}</div>
      <div class="palette__hint">
        ${PALETTE_HINTS.map((hint) => `<span>${icon(hint.icon, 11)} ${escapeHtml(hint.label)} <kbd class="kbd">${escapeHtml(hint.keys)}</kbd></span>`).join("")}
      </div>
    </div>`,
    onMount: (node, overlay) => {
      const input = $("#pal-input", node);
      const list = $("#pal-list", node);
      const run = (index) => {
        const item = results[index];
        if (!item) return;
        overlay.close();
        item.action();
      };
      const paint = () => { list.innerHTML = listHtml(); };

      input.addEventListener("input", () => { query = input.value; build(); paint(); });
      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); activeIndex = Math.min(results.length - 1, activeIndex + 1); paint(); }
        else if (event.key === "ArrowUp") { event.preventDefault(); activeIndex = Math.max(0, activeIndex - 1); paint(); }
        else if (event.key === "Enter") { event.preventDefault(); run(activeIndex); }
      });
      list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-palette-index]");
        if (!button) return;
        run($$("[data-palette-index]", list).indexOf(button));
      });
    }
  });
}

/* ------------------------------------------------------------- Reminders */
const fireReminders = () => {
  const notifications = getNotifications();
  pendingReminders().forEach((reminder) => {
    toast({ title: reminder.title, desc: reminder.body, type: reminder.kind === "overdue" ? "warning" : "info", duration: 6000 });
    markReminderSent(reminder.key);
  });
  if (notifications.desktopNotifications && notificationsSupported() && window.Notification.permission === "granted") {
    const next = pendingReminders()[0];
    if (next) {
      try { new Notification(next.title, { body: next.body }); } catch { /* notifications are best-effort */ }
    }
  }
};

/* ----------------------------------------------------------- Global events */
const openNav = () => { dom.app.classList.add("nav-open"); renderScrim(); };
const closeNav = () => { dom.app.classList.remove("nav-open"); renderScrim(); };

function userMenu(anchor) {
  menu(anchor, [
    { label: "Appearance", icon: "sparkles", onClick: () => navigate("settings", "appearance") },
    { label: "Planning preferences", icon: "settings", onClick: () => navigate("settings", "preferences") },
    { label: "Notifications", icon: "bell", onClick: () => navigate("settings", "notifications") },
    { type: "sep" },
    { label: "Focus preferences", icon: "timer", onClick: () => navigate("focus") },
    { label: "Data & privacy", icon: "download", onClick: () => navigate("settings", "data") },
    { type: "sep" },
    { label: "Run onboarding again", icon: "refresh", onClick: () => startOnboarding() }
  ]);
}

function bindGlobalEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-route]");
    if (nav && !nav.closest("#view")) {
      const param = nav.dataset.param;
      const route = nav.dataset.route;
      closeNav();
      if (param && route === "tasks") navigate("tasks", "overdue");
      else if (param) navigate(route, param);
      else navigate(route);
      return;
    }

    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "palette":
      case "search":
        openPalette();
        break;
      case "quick-add":
        openQuickAdd({ onSaved: rerender });
        break;
      case "toggle-sidebar":
        toggleSidebar();
        break;
      case "open-nav":
        openNav();
        break;
      case "close-nav":
        closeNav();
        break;
      case "show-overdue":
        navigate("today");
        break;
      case "user-menu":
        userMenu(action);
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette(typing ? String(event.target.value || "") : "");
      return;
    }
    if (typing) return;
    if (event.key === "Escape") { closeTopOverlay(); return; }
    if (event.key.toLowerCase() === "q") { event.preventDefault(); openQuickAdd({ onSaved: rerender }); }
    else if (event.key.toLowerCase() === "f") { event.preventDefault(); navigate("focus"); }
    else if (event.key === "g") {
      const once = (next) => {
        window.removeEventListener("keydown", once, true);
        const map = { d: "dashboard", i: "inbox", t: "today", c: "calendar", h: "habits", n: "notes", s: "settings" };
        if (map[next.key.toLowerCase()]) { event.preventDefault(); navigate(map[next.key.toLowerCase()]); }
      };
      window.addEventListener("keydown", once, true);
      setTimeout(() => window.removeEventListener("keydown", once, true), 1400);
    }
  });

  dom.fab.addEventListener("click", () => {
    dom.fab.classList.toggle("is-open");
    if (dom.fab.classList.contains("is-open")) openQuickAdd({ onSaved: rerender });
    setTimeout(() => dom.fab.classList.remove("is-open"), 300);
  });

  window.addEventListener("resize", debounce(() => renderBottomNav(), 200));
}

/* -------------------------------------------------------------------- Boot */
function applyTheme() {
  const ui = getUi();
  const theme = ui.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : ui.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = ui.accent || "violet";
  document.documentElement.dataset.density = ui.density || "comfortable";
}

function boot() {
  hydrate();
  applyTheme();

  const applyChrome = () => {
    applyTheme();
    if (getUi().sidebarCollapsed) dom.app.classList.add("is-collapsed");
    else dom.app.classList.remove("is-collapsed");
  };

  /* Store changes refresh the chrome (nav counts, title). Views repaint themselves
     through their own rerender(), so inline inputs never lose focus mid-typing. */
  subscribe(debounce(() => { applyChrome(); renderChrome(); }, 60));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  bindGlobalEvents();
  start((route) => renderView(route));
  /* Reminders are evaluated on the next tick, never blocking first paint. */
  setTimeout(fireReminders, 1200);
  setInterval(fireReminders, 60000);

  /* Reveal the shell as soon as the first view is on screen. */
  requestAnimationFrame(() => {
    dom.app.hidden = false;
    if (dom.boot) dom.boot.remove();
  });

  if (!onboarded()) setTimeout(() => startOnboarding(), 60);
}

boot();
