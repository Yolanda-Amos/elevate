# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Elevate** — a productivity/task-management SPA. Vanilla JavaScript ES modules, CSS and
hand-rolled SVG. **No build step, no dependencies, no framework.** Open `index.html` via a
static server and it runs.

```
index.html          shell: #boot splash, #app, #sidebar, #topbar, #view, #bottomnav, #fab
serve.cmd           starts a static server on :5173 and opens the browser
js/app.js           app shell — route registry, sidebar/topbar, palette, reminders, boot
js/store.js         single source of truth: state, pub/sub, all CRUD + derived stats
js/views/*.js       one module per view, each exporting a `routes` array
js/{utils,ui,icons,charts,audio,nlp,router,taskrows,taskform}.js   shared subsystems
styles/*.css        hand-written, ~1,400 lines total
```

### Hard constraints

1. **Zero dependencies.** Do not add a package, framework, CDN library or build step. SVG
   charts and ambient audio are generated in code (`charts.js`, `audio.js`) precisely so
   there are no assets or libraries.
2. **Must be served over HTTP.** Native ES modules fail on `file://` (CORS). Use `serve.cmd`.
3. **No `innerHTML` with untrusted data.** Views return HTML strings; always pass text
   through `escapeHtml()`. Interactivity is wired via delegated `data-act` / `data-*`
   attributes, not per-element listeners.

## Commands

```bash
#run the app
serve.cmd                          # or: py -m http.server 5173

#verification (both must pass before you call a change done)
node .validate.mjs                 # syntax + import graph + unused imports  (23 files)
node .smoke.mjs                    # renders/mounts every view, runs store flows, boots the app
```

`node .smoke.mjs` currently runs **163 assertions** and exits non-zero on any failure. It
mirrors `js/` into `.smoke-build/` as `.mjs` (rewriting relative specifiers) so Node can
import the real browser modules, then stubs `document`/`window`/`localStorage`. The stub
dir is deleted on exit.

## Architecture

### The view contract

Every view module exports a `routes` array. `app.js` collects them all and registers each
one with the hash router:

```js
export const routes = [{
  name: "calendar",        // hash segment: #/calendar
  title: "Calendar",       // sidebar label + topbar title
  icon: "calendar",        // an icon() name
  group: "Organise",       // sidebar group heading
  order: 2,                // sort order within the group
  nav: true,               // false = reachable by URL, hidden from the sidebar
  render,                  // (params: string[]) => htmlString
  mount                    // (root: HTMLElement, { rerender, params }) => void
}];
```

`render` must be a **pure function of `params`** — no side effects, because it is called on
every navigation and re-render. `mount` attaches listeners to the `root` element it is given
(see the re-render invariant below).

**Routes currently registered (16):** `dashboard`, `projects`, `calendar`, `focus`, `habits`,
`notes`, `analytics`, `team`, `settings` are visible in the sidebar. `inbox`, `myday`, `today`,
`upcoming`, `tasks`, `goals`, `project` are **`nav: false`** — deliberately hidden from the
sidebar but still live, because the dashboard links into them. Use `hiddenRoute()` in
`tasks.js` for this; don't delete these routes.

### State

- `store.js` owns all state. Views **read via getters and write via `update*` functions**,
  which mutate then call `emit(reason)` → debounced persist + notify subscribers.
- Persistence: `localStorage` key `state.v4`, guarded by `SEED_VERSION` (4) in `data.js`.
  **If you change the shape of persisted state, bump BOTH** — mismatched versions silently
  discard the user's workspace, so bump deliberately, not casually.
- The workspace **starts completely empty**. `setSampleData(true|false)` in `store.js` loads
  or wipes the demo content; it is exposed as the "Sample data" toggle in
  Settings → Data. Never re-introduce a hard-coded seeded `createState()`.
- The signed-in user has **no name and no email** — the UI never renders them. Don't add
  identity chrome back. `displayName(person)` falls back to `"You"`.

## Invariants — breaking these causes bugs that are hard to trace

### 1. Every render mounts into a fresh node

`renderView()` in `app.js` clears `#view` and creates a **new throwaway `div.view__stage`**,
passing *that* to `mount()`. Views attach listeners to the node they're given.

**Do not pass the persistent `#view` element to `mount()`.** Listeners on a long-lived node
accumulate across renders, so after N renders one click fires N handlers. This previously
caused: N stacked modals (reads as a black screen), N stacked close buttons, N duplicate
toasts, and exponential re-render growth that froze the tab. The regression test is
`renders do not accumulate stages` in `.smoke.mjs`.

### 2. `soft` vs hard re-render

`rerender()` (handed to views) calls `renderView(..., { soft: true })` and **does not** call
`closeAllOverlays()` — so a modal/drawer stays open while its own view repaints. Navigation
uses a hard render, which does close them. Keep this distinction.

### 3. The store subscription must not re-render views

In `boot()`, `subscribe()` refreshes **chrome only** (`renderChrome()` — sidebar, topbar,
mobile nav). Views repaint themselves by calling their own `rerender()`. If the subscription
re-rendered the view, typing in any inline filter input would drop focus mid-keystroke.

### 4. `data-tip` tooltips and `icon()` fall back silently

`icon(name)` returns a circle for unknown names instead of throwing. A typo'd icon name is
therefore silent — check the name against the `PATHS` map in `icons.js` (kebab-case, e.g.
`chevron-left`, `arrow-up-right`, `more-h`).

## Conventions

- **Module style:** header comment, ES imports, helpers, `render()`, `mount()`, `routes`.
  Views return **template literals**; there is no virtual DOM.
- **Events:** use one delegated `root.addEventListener("click", ...)` per view and branch on
  `data-act`. Never attach listeners inside loops over rendered items.
- **CSS:** hand-written, BEM-ish (`block__element--modifier`). Class names must exist in
  `styles/`. If you delete a component, delete its CSS too — there is no purge step, so dead
  rules silently accumulate and confuse the next reader.
- **Charts:** extend `charts.js` (SVG string builders) rather than hand-rolling SVG in a view.
- **Intent beats accident.** If a feature was cut on purpose, add a regression assertion so it
  doesn't quietly return — see the removal checks at the end of `.smoke.mjs`.

## Testing workflow

1. Make the change.
2. `node .validate.mjs` — catches syntax errors, bad import specifiers, and unused imports.
3. `node .smoke.mjs` — renders and mounts every view, exercises the store flows, boots the app.
4. **When you remove or rename anything user-facing, add an assertion** in the `app` block of
   `.smoke.mjs` (e.g. `check("no Profile section", !html.includes("st-name"))`). The existing
   checks assert the absence of Plan my day, habit progress, insights, Profile, the sidebar
   identity chip, the sample-data toggle's dismissal, and the greeting's lack of a name.
5. Restart the server and hard-refresh (`Ctrl+Shift+R`) — ES modules are cached hard.

## Gotchas hit in practice

- **The tool limit:** the editing tool rejects writes over ~6,000 characters. For large files,
  write a section then append by replacing a trailing marker comment (e.g. `/* --PART2 -- */`).
- `import` specifiers in `js/views/*.js` are `../store.js`. A `./store.js` there resolves to
  nothing and breaks the whole app at load — this happened once and took the site down.
- `taskrows.js` row markup is relied on by `bindTaskList`; `[data-task]` with no
  `[data-act]` opens the editor, with one dispatches the action.
- Don't let a store write happen inside `render()`. Reads only.
- **Signatures to trust:** `focusStats()` returns `{ totalMinutes, sessions, average, longest,
  byDate, today }` — there is no `avgSession` or `completion` field. `todayOverview()` returns
  `{ score, completedToday, dueToday, doneToday, remaining, overdue, focusMinutes, habitsDone,
  habitsTotal, streak, bestStreak, inbox, myDay }`.

## Deliberate omissions (don't "fix" these)

The product owner cut these on purpose; the absence is asserted in `.smoke.mjs`:

- **Profile settings section** — no name, email, bio or avatar.
- **Subscription / plan gating** — the "AI daily planner is Premium" gate and the pro banner
  are gone. `planMyDay()` was removed entirely.
- **AI features and Integrations settings** — removed (they did nothing).
- **Plan-my-day button**, **habit-progress card**, **"What Elevate noticed"** on the dashboard.
- **My Day / Today / Upcoming / Goals / All tasks / Inbox** are hidden from the sidebar.
- **Onboarding entirely.** There is no setup flow — `js/views/onboarding.js` was deleted, along
  with `state.onboarded`, `completeOnboarding()`, the `#onboarding` mount point and the `.onb*`
  CSS. The app boots straight to the dashboard. There is no first-run gate.

## Known leftovers

- `store.js` still holds `user.name` / `user.email` / `user.bio` (all empty by default) plus
  `color`, `role`, `plan` and `billing`, and exports `updateProfile`. Nothing writes or reads
  them any more — safe to delete if you want the model to match the UI exactly.
- `displayName()` in `store.js` is used by the Team view and taskform; the "You" fallback
  keeps nameless accounts reading correctly.
- `data.js` still defines a full `DEMO_TEAM` roster; it only appears when sample data is on.

