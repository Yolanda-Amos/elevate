/* ==========================================================================
   Elevate — shared utilities: ids, dates, formatting, DOM, storage
   ========================================================================== */

export const pad = (n) => String(n).padStart(2, "0");
export const uid = (prefix = "e") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (n, min, max) => Math.min(Math.max(Number(n) || 0, min), max);
export const clamp01 = (n) => clamp(n, 0, 1);
export const sum = (arr, fn = (x) => x) => arr.reduce((acc, item) => acc + (Number(fn(item)) || 0), 0);
export const avg = (arr, fn) => (arr.length ? sum(arr, fn) / arr.length : 0);
export const unique = (arr) => [...Array.from(new Set(arr))];
export const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
export const truncate = (s = "", n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export const percent = (part, whole) => (!whole ? 0 : Math.round((part / whole) * 100));
export const formatNumber = (n) => new Intl.NumberFormat().format(Number(n) || 0);

export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}
export const sortBy = (arr, keyFn, dir = 1) =>
  [...arr].sort((a, b) => {
    const av = keyFn(a), bv = keyFn(b);
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });
export const hashCode = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};
export const pick = (arr, seed) => arr[hashCode(String(seed)) % arr.length];

/* ---------- Escape / markup ---------- */
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
export const esc = escapeHtml;
/** Highlights every occurrence of `term` inside `text` (both escaped). */
export function highlight(text, term) {
  const safe = escapeHtml(text);
  if (!term || term.length < 2) return safe;
  const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return safe.replace(pattern, '<mark class="hl">$1</mark>');
}

/* ---------- Time and dates (ISO 'YYYY-MM-DD' strings, local time) ---------- */
export const MS_DAY = 86400000;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const toISO = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (iso, days) => {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
};
export const addMonths = (iso, months) => {
  const d = parseISO(iso) || new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / MS_DAY);
export const isSameDay = (a, b) => Boolean(a && b) && a === b;
export const isToday = (iso) => iso === todayISO();
export const isPast = (iso) => Boolean(iso) && iso < todayISO();
export const isFuture = (iso) => Boolean(iso) && iso > todayISO();
export const isWeekend = (iso) => [0, 6].includes((parseISO(iso) || new Date()).getDay());

export function startOfWeek(iso = todayISO(), weekStart = 1) {
  const d = parseISO(iso);
  const shift = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - shift);
  return toISO(d);
}
export const endOfWeek = (iso, weekStart = 1) => addDays(startOfWeek(iso, weekStart), 6);
export const startOfMonth = (iso) => { const d = parseISO(iso); d.setDate(1); return toISO(d); };
export const endOfMonth = (iso) => {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
export const rangeDates = (from, to) => {
  const out = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 1000) { out.push(cursor); cursor = addDays(cursor, 1); guard += 1; }
  return out;
};
export const lastNDays = (n, endISO = todayISO()) =>
  rangeDates(addDays(endISO, -(n - 1)), endISO);
export const weekDates = (iso = todayISO(), weekStart = 1) =>
  rangeDates(startOfWeek(iso, weekStart), endOfWeek(iso, weekStart));

/** 6x7 grid of ISO dates covering the month of `iso`. */
export function monthMatrix(iso, weekStart = 1) {
  const first = startOfMonth(iso);
  const gridStart = startOfWeek(first, weekStart);
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    weeks.push(rangeDates(addDays(gridStart, w * 7), addDays(gridStart, w * 7 + 6)));
  }
  return weeks;
}

/* ---------- Formatting helpers ---------- */
export function formatDate(iso, style = "medium") {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!d) return "";
  switch (style) {
    case "short": return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
    case "compact": return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    case "long": return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    case "month": return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "day": return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    default: return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  }
}
export function relativeDay(iso) {
  if (!iso) return "";
  const delta = diffDays(iso, todayISO());
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1 && delta < 7) return `${WEEKDAYS[parseISO(iso).getDay()]}`;
  if (delta < -1 && delta > -7) return `Last ${WEEKDAYS[parseISO(iso).getDay()]}`;
  return formatDate(iso, "day");
}
export function dueLabel(iso, opts = {}) {
  if (!iso) return "No date";
  const delta = diffDays(iso, todayISO());
  const prefix = delta < 0 ? "Overdue · " : "";
  const base = Math.abs(delta) < 7 ? relativeDay(iso) : formatDate(iso, "day");
  return `${prefix}${base}${opts.suffix || ""}`;
}
export const toMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fromMinutes = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(Math.round(mins % 60))}`;
export function formatTime(hhmm, { compact = false } = {}) {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  if (compact) return m ? `${hour}:${pad(m)}${suffix.toLowerCase()}` : `${hour}${suffix.toLowerCase()}`;
  return m ? `${hour}:${pad(m)} ${suffix}` : `${hour}:00 ${suffix}`;
}
export function formatDuration(mins, { short = false } = {}) {
  const total = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (short) return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
  return h ? `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min` : ""}` : `${m} min`;
}
export const timeRange = (start, end) => `${formatTime(start, { compact: true })} – ${formatTime(end, { compact: true })}`;
export const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
export const greetingEmoji = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return "☀️";
  if (h < 18) return "🌤️";
  return "🌙";
};

/* Uplifting lines shown under the greeting. Picked once per page load, so the
   dashboard greets you differently each time you come back. */
const MOTIVATIONS = [
  "you are great at what you do",
  "you have already done enough to be proud of today",
  "small steps count, and you are taking them",
  "the work you are doing matters",
  "you are allowed to take it one thing at a time",
  "your future self is already grateful for today",
  "you do not have to be perfect to be making progress",
  "you are doing better than you think",
  "today is a good day to begin",
  "you are more capable than yesterday's doubts suggested",
  "steady beats hurried, and you are steady",
  "you have handled harder days than this one",
  "every finished task is proof you can finish things",
  "you are worth the effort you are putting in",
  "progress you cannot see is still progress",
  "you are allowed to be proud of a quiet day"
];

export const motivation = () => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];

export function relativeTime(ts) {
  const diff = Date.now() - Number(ts);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(toISO(new Date(Number(ts))), "medium");
}

/* ---------- DOM helpers ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const $id = (id) => document.getElementById(id);

export function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  });
  if (html) node.innerHTML = html;
  return node;
}

/** Delegated listener: `on(root, 'click', '[data-act="x"]', handler)`. */
export function on(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  });
}

export function debounce(fn, wait = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
export function throttle(fn, wait = 120) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) { last = now; fn(...args); }
    else if (!timer) {
      timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, remaining);
    }
  };
}

export async function withLoading(button, task, minDelay = 320) {
  if (button) { button.classList.add("is-loading"); button.setAttribute("aria-busy", "true"); }
  const started = Date.now();
  try {
    return await task();
  } finally {
    const elapsed = Date.now() - started;
    const wait = Math.max(0, minDelay - elapsed);
    setTimeout(() => {
      if (button) { button.classList.remove("is-loading"); button.removeAttribute("aria-busy"); }
    }, wait);
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function download(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ---------- Storage ---------- */
const K_PREFIX = "elevate.";
export function readStore(key, fallback = null) {
  try {
    const raw = localStorage.getItem(K_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key, value) {
  try {
    localStorage.setItem(K_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearStore(key) {
  try { localStorage.removeItem(K_PREFIX + key); return true; } catch { return false; }
}
export const storageBytes = () =>
  Object.keys(localStorage).reduce((acc, k) => acc + k.length + (localStorage.getItem(k) || "").length, 0);

/* ---------- Identity & small bits ---------- */
export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") ||
  String(name).slice(0, 1).toUpperCase();

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
export const isMac = /Mac|iPhone|iPad|iPod/.test(ua);
export const modKey = isMac ? "⌘" : "Ctrl";
export const altKeyLabel = isMac ? "⌥" : "Alt";
export const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
export const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 860;

export function animateCount(node, from, to, duration = 700) {
  if (!node) return;
  const start = performance.now();
  const delta = to - from;
  const step = (now) => {
    const p = clamp01((now - start) / duration);
    const eased = 1 - (1 - p) ** 3;
    node.textContent = Math.round(from + delta * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const pluralize = (count, singular, plural) =>
  `${count} ${count === 1 ? singular : plural || `${singular}s`}`;

export function scrollIntoViewSoft(node, block = "center") {
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
}


