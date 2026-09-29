/* ==========================================================================
   Elevate — Icon system (inline SVG, no external assets)
   Usage: icon("inbox", 18) → svg markup string
   ========================================================================== */

const S = 1.75; // stroke width

const PATHS = {
  /* Navigation */
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  tasks: '<path d="M11 6h10M11 12h10M11 18h10"/><path d="m3 6 1.6 1.6L7.5 4.6M3 12l1.6 1.6 2.9-3M3 18l1.6 1.6 2.9-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  "calendar-clock": '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M12 13.5V16l2 1.2"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  folder: '<path d="M2 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6L10.4 7H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  analytics: '<path d="M3 21h18"/><rect x="4" y="10" width="4" height="8" rx="1.2"/><rect x="10" y="5" width="4" height="13" rx="1.2"/><rect x="16" y="13" width="4" height="5" rx="1.2"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.4 1.8M9 2h6M19 5.5l1.5 1.5"/>',
  note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1.6"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5Z"/><path d="M9 22v-6h6v6"/>',
  sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  flame: '<path d="M12 22c4 0 6.5-2.6 6.5-6.2 0-4.4-4.2-6.6-3.4-11.8-2.6.6-4.6 2.6-4.6 5 0 1.4.6 2.2.6 3.2a2 2 0 0 1-3.5 1.4C6.4 12.2 6 10.6 6 9.4c0 0-1.5 2-1.5 5C4.5 18.6 7.6 22 12 22Z"/>',

  /* Actions */
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.4 2.4 2.4 4.6-5"/>',
  flag: '<path d="M4 22V4a2 2 0 0 1 2-2h11l-2.2 4L17 10H6"/><path d="M4 10h13"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8l-8.2-8.2Z"/><circle cx="7.2" cy="7.2" r="1.4" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  paperclip: '<path d="M21.4 11.1 12.3 20.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 1 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 1 1-2.6-2.6l8-8"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="m6 7 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  "more-h": '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  "more-v": '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-up": '<path d="m6 15 6-6 6 6"/>',
  "chevron-left": '<path d="m14 6-6 6 6 6"/>',
  "chevron-right": '<path d="m10 6 6 6-6 6"/>',
  "chevrons-left": '<path d="m11 6-6 6 6 6M19 6l-6 6 6 6"/>',
  "arrow-right": '<path d="M4 12h16M14 6l6 6-6 6"/>',
  "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
  "corner-down-right": '<path d="M4 4h6a4 4 0 0 1 4 4v12"/><path d="m11 17 3 3 3-3"/>',

  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3M7 7l5-5 5 5M5 21h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5 0l1.7-1.7a5 5 0 0 0-7-7L11 5.5"/><path d="M14 11a5 5 0 0 0-7.5 0L4.8 12.7a5 5 0 0 0 7 7L13 18.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
  pause: '<rect x="7" y="4" width="3.6" height="16" rx="1.2"/><rect x="13.4" y="4" width="3.6" height="16" rx="1.2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.4"/>',
  skip: '<path d="M5 4l10 8-10 8V4Z"/><path d="M19 4v16"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h1.6a2.6 2.6 0 0 1 0 5.2H17"/><path d="M5.5 3.5c0 .9.8 1.3.8 2.2M9.5 3c0 .9.8 1.3.8 2.2"/>',
  volume: '<path d="M11 5 6.6 9H3v6h3.6L11 19V5Z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.6 6.8a7 7 0 0 1 0 10.4"/>',
  mute: '<path d="M11 5 6.6 9H3v6h3.6L11 19V5Z"/><path d="m16 10 4 4M20 10l-4 4"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M16 21h3a2 2 0 0 0 2-2v-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M16 21v-3a2 2 0 0 1 2-2h3M8 21v-3a2 2 0 0 0-2-2H3"/>',
  waves: '<path d="M2 12c2 0 3-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3M2 17c2 0 3-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3M2 7c2 0 3-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',

  /* Views */
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  columns: '<rect x="3" y="3" width="7" height="18" rx="2"/><rect x="14" y="3" width="7" height="12" rx="2"/>',
  kanban: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M8 7v7M12 7v10M16 7v4"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  timeline: '<path d="M5 3v18"/><rect x="9" y="4.5" width="11" height="4.5" rx="1.6"/><rect x="9" y="14" width="8" height="4.5" rx="1.6"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M9 9v12"/>',
  pin: '<path d="M12 2a4.2 4.2 0 0 1 4.2 4.2c0 3-4.2 8-4.2 8s-4.2-5-4.2-8A4.2 4.2 0 0 1 12 2Z"/><path d="M12 14.2V22"/>',
  star: '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L3.6 9.8l6.5-.9L12 3Z"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5V4.5Z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/>',
  droplet: '<path d="M12 2.5 7 9a7 7 0 1 0 10 0l-5-6.5Z"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9.5v5M17.5 6.5v11M20.5 9.5v5M6.5 12h11"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 9.4A4.9 4.9 0 0 1 12 6.2a4.9 4.9 0 0 1 8.5 3.2c0 5.6-8.5 11.1-8.5 11.1Z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.6 20a6.5 6.5 0 0 1 12.8 0"/><path d="M16 5.3a3.5 3.5 0 0 1 0 6.4M17.8 20a6.4 6.4 0 0 0-1.9-4.6"/>',
  shield: '<path d="M12 22s8-3.6 8-10V5.2L12 2 4 5.2V12c0 6.4 8 10 8 10Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.6"/><path d="M2 10h20"/>',
  plug: '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z"/><path d="M12 17v5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5V11M12 8h.01"/>',
  milestone: '<path d="M6 22V4l3.5 2.5L14 4v10l-4.5 2.5L6 14"/><path d="M18 8v14"/>',
  trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  wallet: '<rect x="2.5" y="6" width="19" height="13" rx="2.6"/><path d="M2.5 11h19M17 15h.01"/>',
  leaf: '<path d="M4 20c0-8 5-14 16-15 1 11-5 16-13 16H4Z"/><path d="M9 15c2-2.5 5-4 8-4.5"/>',

  /* Small extras */
  minus: '<path d="M5 12h14"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  "arrow-left": '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  sunrise: '<path d="M12 3v5M5.6 8.6l2.1 2.1M2 14h20M18.4 8.6l-2.1 2.1M8 14a4 4 0 0 1 8 0M3 18h18"/>',
  spark: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 21v-8"/>',




};

/** Renders an inline SVG for the given icon name. */
export function icon(name, size = 18, extraClass = "") {
  const inner = PATHS[name] || PATHS.circle;
  return `<svg class="i${extraClass ? ` ${extraClass}` : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

export const hasIcon = (name) => Boolean(PATHS[name]);
export const iconNames = () => Object.keys(PATHS);

/** The Elevate brand mark. */
export const brandMark = (size = 20) =>
  `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><path d="M7 24 16 6l9 18-9-5L7 24Z" fill="currentColor"/></svg>`;

export const PRIORITY_META = {
  urgent: { label: "Urgent", color: "var(--p-urgent)", icon: "alert", weight: 0 },
  high: { label: "High", color: "var(--p-high)", icon: "flag", weight: 1 },
  medium: { label: "Medium", color: "var(--p-medium)", icon: "flag", weight: 2 },
  low: { label: "Low", color: "var(--p-low)", icon: "flag", weight: 3 },
  none: { label: "No priority", color: "var(--p-none)", icon: "circle", weight: 4 }
};

/** Palette used for projects, tags, goals and habits. */
export const SWATCHES = [
  { name: "Violet", hex: "#5b5bd6" },
  { name: "Indigo", hex: "#4a5ad8" },
  { name: "Blue", hex: "#2f6fd0" },
  { name: "Teal", hex: "#0f8a83" },
  { name: "Emerald", hex: "#159a63" },
  { name: "Lime", hex: "#6d9c17" },
  { name: "Amber", hex: "#c07409" },
  { name: "Orange", hex: "#d1622a" },
  { name: "Rose", hex: "#c8437c" },
  { name: "Red", hex: "#cf3b45" },
  { name: "Slate", hex: "#4d5461" },
  { name: "Sand", hex: "#a4885f" }
];

/** Icons available when picking a project/habit icon. */
export const PICKABLE_ICONS = [
  "folder", "target", "book", "note", "tasks", "grid", "layout", "spark",
  "timer", "heart", "dumbbell", "droplet", "leaf", "wallet", "users", "trending"
];
