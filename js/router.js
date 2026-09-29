/* ==========================================================================
   Elevate — Hash router
   Routes look like #/tasks, #/project/p_website, #/project/p_website/kanban,
   #/settings/appearance
   ========================================================================== */

const routes = new Map();
let handler = null;

export function register(name, definition) {
  routes.set(name, definition);
}

export const getRoutes = () => routes;
export const getRoute = (name) => routes.get(name);

export function parseHash(hash = window.location.hash) {
  const clean = String(hash || "").replace(/^#\/?/, "");
  if (!clean) return { name: "dashboard", params: [], path: "" };
  const parts = clean.split("/").filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || "dashboard", params: parts.slice(1), path: clean };
}

export function pathFor(name, ...params) {
  const tail = params.filter((p) => p !== undefined && p !== null && p !== "").map((p) => encodeURIComponent(p));
  return `#/${[name, ...tail].join("/")}`;
}

export function navigate(name, ...params) {
  const target = typeof name === "string" && name.startsWith("#") ? name : pathFor(name, ...params);
  if (window.location.hash === target) {
    if (handler) handler(parseHash(target));
    return;
  }
  window.location.hash = target;
}

export function replace(name, ...params) {
  const target = pathFor(name, ...params);
  const url = `${window.location.pathname}${window.location.search}${target}`;
  window.history.replaceState(null, "", url);
  if (handler) handler(parseHash(target));
}

export function current() {
  return parseHash();
}

export function start(onChange) {
  handler = onChange;
  window.addEventListener("hashchange", () => {
    const route = current();
    onChange(route);
  });
  if (!window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/dashboard`);
  }
  onChange(current());
}

export function isCurrent(name, ...params) {
  const route = current();
  return route.name === name && (params.length === 0 || params.every((p, i) => route.params[i] === p));
}
