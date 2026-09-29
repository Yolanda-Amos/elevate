/* ==========================================================================
   Elevate — UI kit: toasts, modals, drawers, menus, confirms, empty states
   ========================================================================== */
import { $, $$, el, escapeHtml, uid } from "./utils.js";
import { icon } from "./icons.js";
import { initials } from "./utils.js";

/* ---------------------------------------------------------------- Toasts */
export function toast(opts = {}) {
  const {
    title = "",
    desc = "",
    type = "default",
    duration = 3600,
    actionLabel = "",
    onAction = null,
    icon: iconName = ""
  } = typeof opts === "string" ? { title: opts } : opts;

  const stack = $("#toasts");
  if (!stack) return { close() {} };

  const fallback = { success: "check-circle", error: "alert", warning: "alert", info: "info", default: "spark" };
  const node = el("div", { class: `toast toast--${type}`, role: "status" }, `
    <span class="toast__icon">${icon(iconName || fallback[type] || fallback.default, 15)}</span>
    <span class="toast__text">
      ${title ? `<span class="toast__title">${escapeHtml(title)}</span>` : ""}
      ${desc ? `<div class="toast__desc">${esc(desc)}</div>` : ""}
    </span>
    ${actionLabel ? `<button class="toast__action" type="button">${escapeHtml(actionLabel)}</button>` : ""}
  `);

  const close = () => {
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 200);
  };

  if (actionLabel) {
    $(".toast__action", node).addEventListener("click", () => {
      if (typeof onAction === "function") onAction();
      close();
    });
  }

  stack.appendChild(node);
  if (duration > 0) setTimeout(close, duration);
  return { close, node };
}
const esc = escapeHtml;

/* -------------------------------------------------------- Overlay plumbing */
const overlayStack = [];

function focusables(root) {
  return $$(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    root
  ).filter((n) => n.offsetParent !== null || n === document.activeElement);
}

function trapFocus(root, event) {
  if (event.key !== "Tab") return;
  const list = focusables(root);
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function rememberFocus() {
  const active = document.activeElement;
  return () => { if (active && typeof active.focus === "function") active.focus(); };
}

function mountOverlay(entry) {
  overlayStack.push(entry);
  const onKey = (event) => {
    if (overlayStack[overlayStack.length - 1] !== entry) return;
    if (event.key === "Escape") { event.preventDefault(); entry.close(); }
    else trapFocus(entry.node, event);
  };
  entry.keyHandler = onKey;
  document.addEventListener("keydown", onKey, true);
}

function unmountOverlay(entry) {
  const index = overlayStack.indexOf(entry);
  if (index >= 0) overlayStack.splice(index, 1);
  document.removeEventListener("keydown", entry.keyHandler, true);
  entry.node.remove();
  if (entry.restoreFocus) entry.restoreFocus();
  if (typeof entry.onClose === "function") entry.onClose();
}

export const overlaysOpen = () => overlayStack.length;
export function closeTopOverlay() {
  const entry = overlayStack[overlayStack.length - 1];
  if (entry) entry.close();
}
export function closeAllOverlays() {
  [...overlayStack].reverse().forEach((entry) => entry.close());
}

/* ----------------------------------------------------------------- Modals */
export function modal(opts = {}) {
  const {
    title = "", subtitle = "", body = "", footer = "", size = "md",
    className = "", dismissible = true, align = "center", onMount = null, onClose = null
  } = opts;

  const restoreFocus = rememberFocus();
  const node = el("div", { class: `overlay${align === "top" ? " overlay--top" : ""}` });
  node.innerHTML = `
    <div class="modal modal--${size} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title || "Dialog")}">
      ${title || subtitle ? `<div class="modal__head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<div class="modal__head-sub">${esc(subtitle)}</div>` : ""}
        </div>
        <button class="icon-btn modal__close" type="button" data-overlay-close aria-label="Close">${icon("x", 17)}</button>
      </div>` : ""}
      <div class="modal__body${footer ? "" : " modal__body--flush"}">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
    </div>
  `;

  const entry = {
    node,
    restoreFocus,
    onClose,
    close() { if (overlayStack.includes(entry)) unmountOverlay(entry); }
  };

  node.addEventListener("click", (event) => {
    if (event.target.closest("[data-overlay-close]")) { entry.close(); return; }
    if (dismissible && event.target === node) entry.close();
  });

  $("#overlays").appendChild(node);
  mountOverlay(entry);
  if (typeof onMount === "function") onMount($(".modal", node), entry);
  setTimeout(() => {
    const target = $("[autofocus]", node) || focusables($(".modal", node))[0];
    if (target) target.focus();
  }, 60);
  return entry;
}

/* ---------------------------------------------------------------- Drawers */
export function drawer(opts = {}) {
  const { title = "", body = "", footer = "", wide = false, onMount = null, onClose = null, headerExtra = "" } = opts;
  const restoreFocus = rememberFocus();
  const node = el("div", { class: "overlay overlay--plain" });
  node.style.padding = "0";
  node.style.display = "block";
  node.innerHTML = `
    <aside class="drawer${wide ? " drawer--wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title || "Panel")}">
      <header class="drawer__head">
        <div class="grow"><h2>${esc(title)}</h2></div>
        ${headerExtra}
        <button class="icon-btn" type="button" data-overlay-close aria-label="Close">${icon("x", 17)}</button>
      </header>
      <div class="drawer__body${footer ? "" : " drawer__body--flush"}">${body}</div>
      ${footer ? `<div class="drawer__foot">${footer}</div>` : ""}
    </aside>
  `;

  const entry = {
    node,
    restoreFocus,
    onClose,
    close() { if (overlayStack.includes(entry)) unmountOverlay(entry); }
  };

  node.addEventListener("click", (event) => {
    if (event.target === node || event.target.closest("[data-overlay-close]")) entry.close();
  });

  $("#overlays").appendChild(node);
  mountOverlay(entry);
  if (typeof onMount === "function") onMount($(".drawer", node), entry);
  setTimeout(() => {
    const target = $("[autofocus]", node) || focusables($(".drawer", node))[0];
    if (target) target.focus();
  }, 80);
  return entry;
}

/* ------------------------------------------------------------ Confirmations */
export function confirmDialog(opts = {}) {
  const {
    title = "Are you sure?", message = "", confirmLabel = "Confirm",
    cancelLabel = "Cancel", danger = false, icon: iconName = ""
  } = opts;

  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };

    modal({
      title,
      size: "sm",
      body: `
        <div class="row gap-3" style="align-items:flex-start">
          <span class="empty__art empty__art--muted" style="width:38px;height:38px;border-radius:var(--r-sm);margin:0">
            ${icon(iconName || (danger ? "alert" : "info"), 17)}
          </span>
          <p class="text-2 fs-sm" style="margin-top:2px">${esc(message)}</p>
        </div>`,
      footer: `
        <button class="btn grow" type="button" data-confirm-cancel>${esc(cancelLabel)}</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" data-confirm-ok>${esc(confirmLabel)}</button>`,
      onMount(node, api) {
        $("[data-confirm-cancel]", node).addEventListener("click", () => { done(false); api.close(); });
        $("[data-confirm-ok]", node).addEventListener("click", () => { done(true); api.close(); });
      },
      onClose: () => done(false)
    });
  });
}

/* ------------------------------------------------------------------ Menus */
let openMenu = null;

export function closeMenu() {
  if (openMenu) {
    openMenu.node.remove();
    document.removeEventListener("click", openMenu.onDocClick, true);
    document.removeEventListener("keydown", openMenu.onKey, true);
    window.removeEventListener("resize", openMenu.onDocClick);
    openMenu = null;
  }
}

/**
 * Opens a floating menu anchored to `anchor`.
 * items: [{ label, icon, shortcut, onClick, danger, active, disabled }
 *        | { type: 'sep' } | { type: 'label', label }]
 */
export function menu(anchor, items, opts = {}) {
  closeMenu();
  const { align = "end", width = null } = opts;
  const node = el("div", { class: "menu", role: "menu" });
  if (width) node.style.width = `${width}px`;

  items.forEach((item, index) => {
    if (!item) return;
    if (item.type === "sep") { node.appendChild(el("div", { class: "menu__sep" })); return; }
    if (item.type === "label") { node.appendChild(el("div", { class: "menu__label", text: item.label })); return; }

    const btn = el("button", {
      class: `menu__item${item.danger ? " menu__item--danger" : ""}${item.active ? " is-active" : ""}`,
      type: "button",
      role: "menuitem",
      "data-menu-index": String(index)
    }, `
      ${item.icon ? icon(item.icon, 15) : '<span style="width:15px"></span>'}
      <span class="grow truncate">${esc(item.label)}</span>
      ${item.shortcut ? `<span class="menu__shortcut">${esc(item.shortcut)}</span>` : ""}
    `);
    if (item.disabled) btn.setAttribute("disabled", "true");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeMenu();
      if (!item.disabled && typeof item.onClick === "function") item.onClick();
    });
    node.appendChild(btn);
  });

  document.body.appendChild(node);

  const rect = anchor.getBoundingClientRect();
  const menuRect = node.getBoundingClientRect();
  let left = align === "start" ? rect.left : rect.right - menuRect.width;
  let top = rect.bottom + 6;
  if (top + menuRect.height > window.innerHeight - 8) top = Math.max(8, rect.top - menuRect.height - 6);
  left = Math.min(Math.max(8, left), window.innerWidth - menuRect.width - 8);
  node.style.position = "fixed";
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;

  const onDocClick = (event) => { if (!node.contains(event.target)) closeMenu(); };
  const onKey = (event) => { if (event.key === "Escape") closeMenu(); };
  setTimeout(() => {
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
  window.addEventListener("resize", onDocClick);

  openMenu = { node, onDocClick, onKey };
  return node;
}

/* ------------------------------------------------------------- Empty state */
export function emptyState({ icon: iconName = "spark", title = "", text = "", actions = "", muted = false, small = false } = {}) {
  return `
    <div class="empty${small ? " empty--sm" : ""}">
      <span class="empty__art${muted ? " empty__art--muted" : ""}">${icon(iconName, 22)}</span>
      ${title ? `<div class="empty__title">${esc(title)}</div>` : ""}
      ${text ? `<p class="empty__text">${text}</p>` : ""}
      ${actions ? `<div class="empty__actions">${actions}</div>` : ""}
    </div>
  `;
}

/* ---------------------------------------------------------------- Skeletons */
export const skeletonList = (rows = 4) =>
  `<div class="col gap-3">${Array.from({ length: rows }, () => `
    <div class="row gap-3" style="align-items:center">
      <div class="skel" style="width:20px;height:20px;border-radius:50%"></div>
      <div class="grow">
        <div class="skel skel--text" style="width:${45 + Math.round(Math.random() * 40)}%"></div>
        <div class="skel skel--text" style="width:22%;height:9px"></div>
      </div>
    </div>`).join("")}</div>`;

export const skeletonCards = (count = 3) =>
  `<div class="stat-grid">
    ${Array.from({ length: count }, () => `
      <div class="card skel-card">
        <div class="skel skel--title"></div>
        <div class="skel skel--text" style="width:80%"></div>
        <div class="skel skel--text" style="width:60%"></div>
      </div>`).join("")}
  </div>`;

/* --------------------------------------------------------------- Fragments */
export function avatar(person = {}, size = "") {
  const label = person.name || person.email || "?";
  const cls = `avatar${size ? ` avatar--${size}` : ""}`;
  if (person.avatar) {
    return `<span class="${cls}" data-tip="${esc(label)}"><img src="${esc(person.avatar)}" alt="${esc(label)}"></span>`;
  }
  const accent = person.color ? ` style="background:${esc(person.color)}22;color:${esc(person.color)}"` : "";
  return `<span class="${cls}" data-tip="${esc(label)}"${accent}>${esc(initials(label))}</span>`;
}

export const progressRing = (value, { size = 64, stroke = 6, label = "", tone = "" } = {}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const offset = circumference - (pct / 100) * circumference;
  return `
    <span class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"></circle>
        <circle class="ring__fill" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"
          ${tone ? `style="stroke:${tone}"` : ""}
          stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
      </svg>
      <span class="ring__value" style="font-size:${Math.round(size / 4.4)}px">${label || `${pct}%`}</span>
    </span>`;
};

export const progressBar = (value, variant = "", thin = false) =>
  `<div class="progress ${thin ? "progress--xs" : ""} ${variant}">
     <div class="progress__bar" style="width:${Math.min(100, Math.max(0, value))}%"></div>
   </div>`;

export const fileSize = (bytes) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

/** Inline validation for HTML-string forms. rules: { name: (value) => error|"" } */
export function validate(form, rules) {
  let valid = true;
  let firstInvalid = null;
  Object.entries(rules).forEach(([name, rule]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    const field = input.closest(".field");
    const errorNode = field ? field.querySelector(".field__error") : null;
    const message = rule(String(input.value || "").trim(), input);
    if (message) {
      valid = false;
      if (field) field.classList.add("has-error");
      input.setAttribute("aria-invalid", "true");
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 450);
      if (errorNode) errorNode.innerHTML = `${icon("alert", 12)} ${esc(message)}`;
      if (!firstInvalid) firstInvalid = input;
    } else {
      if (field) field.classList.remove("has-error");
      input.removeAttribute("aria-invalid");
      if (errorNode) errorNode.innerHTML = "";
    }
  });
  if (!valid && firstInvalid) firstInvalid.focus();
  return valid;
}

export { uid };



