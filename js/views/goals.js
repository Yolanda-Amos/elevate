/* ==========================================================================
   Elevate — Goals: milestone + metric goals with progress rings
   ========================================================================== */
import { escapeHtml, relativeDay, $, clamp, formatNumber } from "../utils.js";
import { icon, SWATCHES, PICKABLE_ICONS } from "../icons.js";
import { emptyState, toast, modal, menu, confirmDialog, progressRing } from "../ui.js";
import {
  getGoals, getGoal, createGoal, updateGoal, deleteGoal, addMilestone,
  toggleMilestone, setGoalProgress, goalProgress
} from "../store.js";

const TYPE_LABEL = { milestone: "Milestones", metric: "Metric" };

function goalCard(goal) {
  const pct = Math.round(goalProgress(goal));
  const due = goal.dueDate ? relativeDay(goal.dueDate) : "No deadline";
  const miles = goal.milestones || [];
  return `
    <article class="card goal-card" data-goal="${goal.id}">
      <div class="goal-card__top">
        <span class="habit-card__icon" style="background:${goal.color}1a;color:${goal.color}">${icon(goal.icon || "target", 17)}</span>
        <div class="grow">
          <div class="goal-card__title">${escapeHtml(goal.title)}</div>
          <div class="fs-2xs text-3">${escapeHtml(TYPE_LABEL[goal.type] || goal.type)} · ${escapeHtml(due)}${goal.status === "completed" ? " · completed" : ""}</div>
        </div>
        ${progressRing(pct, { size: 54, stroke: 5, label: `${pct}%` })}
        <button class="icon-btn" type="button" data-act="goal-menu" data-goal="${goal.id}" data-tip="More">${icon("more-h", 15)}</button>
      </div>

      <p class="fs-xs text-2 clamp-2">${escapeHtml(goal.description || "")}</p>

      ${goal.type === "metric"
      ? `<div class="row gap-3" style="align-items:center">
            <div class="progress grow"><div class="progress__bar" style="width:${pct}%;background:${goal.color}"></div></div>
            <span class="fs-xs tnum">${formatNumber(goal.current || 0)} / ${formatNumber(goal.target || 0)} ${escapeHtml(goal.unit || "")}</span>
            <button class="icon-btn" type="button" data-act="goal-step" data-goal="${goal.id}" data-step="1" data-tip="Add one">${icon("plus", 13)}</button>
            <button class="icon-btn" type="button" data-act="goal-step" data-goal="${goal.id}" data-step="-1" data-tip="Remove one">${icon("minus", 13)}</button>
          </div>`
      : miles.length
        ? `<div class="col gap-1">${miles.map((milestone) => `
              <button class="goal-mile${milestone.done ? " is-done" : ""}" type="button" data-act="goal-mile" data-goal="${goal.id}" data-mile="${milestone.id}"
                style="text-align:left;background:none;border:0;width:100%;cursor:pointer">
                <span class="check${milestone.done ? " is-done" : ""}">${icon("check", 11)}</span>
                <span class="grow truncate">${escapeHtml(milestone.title)}</span>
              </button>`).join("")}
            </div>`
        : `<p class="fs-2xs text-3">No milestones yet — add the first step.</p>`}

      <div class="row gap-2 fs-2xs text-3">
        <span>${icon("milestone", 11)} ${miles.filter((m) => m.done).length}/${miles.length} milestones</span>
        <span class="grow"></span>
        <button class="btn btn--ghost btn--sm" type="button" data-act="goal-add-mile" data-goal="${goal.id}">${icon("plus", 12)} Milestone</button>
      </div>
    </article>`;
}

export function render() {
  const goals = getGoals();
  const active = goals.filter((goal) => goal.status !== "archived");
  const avg = active.length ? Math.round(active.reduce((sum, goal) => sum + goalProgress(goal), 0) / active.length) : 0;
  return `
    <div class="col gap-5">
      <header class="page-head">
        <div class="page-head__main">
          <div class="page-head__eyebrow">Grow</div>
          <h1>Goals</h1>
          <p class="page-head__sub">${active.length} active goal${active.length === 1 ? "" : "s"} · ${avg}% average progress.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-act="new-goal">${icon("plus", 15)} New goal</button>
        </div>
      </header>

      ${active.length
      ? `<div class="goal-grid">${active.map(goalCard).join("")}</div>`
      : emptyState({
        icon: "target", title: "No goals yet",
        text: "Define what winning looks like, then let milestones pull you there.",
        actions: `<button class="btn btn--primary btn--sm" type="button" data-act="new-goal">${icon("plus", 14)} Create your first goal</button>`
      })}
    </div>`;
}

let pendingRerender = null;

/* -------------------------------------------------------------- Goal modal */
function goalModal(existing = null) {
  let colorChoice = existing ? existing.color : SWATCHES[0].hex;
  let iconChoice = existing ? existing.icon : "target";

  modal({
    title: existing ? "Edit goal" : "New goal",
    subtitle: "Milestone goals track steps; metric goals track a number.",
    body: `
      <div class="col gap-4">
        <label class="field"><span class="field__label">Title</span>
          <input class="input" id="gl-title" maxlength="80" placeholder="e.g. Ship the beta" value="${existing ? escapeHtml(existing.title) : ""}" autofocus /></label>
        <label class="field"><span class="field__label">Why it matters</span>
          <textarea class="textarea" id="gl-desc" rows="2" placeholder="One line of motivation">${existing ? escapeHtml(existing.description || "") : ""}</textarea></label>
        <div class="detail__grid">
          <label class="field"><span class="field__label">Type</span>
            <select class="select" id="gl-type">
              <option value="milestone"${!existing || existing.type === "milestone" ? " selected" : ""}>Milestones</option>
              <option value="metric"${existing && existing.type === "metric" ? " selected" : ""}>Metric</option>
            </select></label>
          <label class="field"><span class="field__label">Deadline</span>
            <input class="input" id="gl-due" type="date" value="${existing && existing.dueDate ? existing.dueDate : ""}" /></label>
          <label class="field"><span class="field__label">Target</span>
            <input class="input" id="gl-target" type="number" min="1" value="${existing && existing.target ? existing.target : 10}" /></label>
          <label class="field"><span class="field__label">Unit</span>
            <input class="input" id="gl-unit" maxlength="14" placeholder="books, USD…" value="${existing && existing.unit ? escapeHtml(existing.unit) : ""}" /></label>
        </div>
        <div class="col gap-2">
          <span class="field__label">Colour</span>
          <div class="accent-row">
            ${SWATCHES.slice(0, 8).map((swatch) => `
              <button class="accent-dot${swatch.hex === colorChoice ? " is-active" : ""}" type="button" data-color="${swatch.hex}"
                style="background:${swatch.hex};color:${swatch.hex}" aria-label="${swatch.name}"></button>`).join("")}
          </div>
        </div>
        <div class="col gap-2">
          <span class="field__label">Icon</span>
          <div class="row gap-2 wrap">
            ${PICKABLE_ICONS.slice(0, 10).map((name) => `
              <button class="icon-btn${name === iconChoice ? " is-active" : ""}" type="button" data-icon="${name}"
                style="${name === iconChoice ? "background:var(--accent-soft);color:var(--accent-ink)" : ""}">${icon(name, 15)}</button>`).join("")}
          </div>
        </div>
      </div>`,
    footer: `
      ${existing ? `<button class="btn btn--danger" type="button" id="gl-delete">Delete</button>` : ""}
      <span class="grow"></span>
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="gl-save">${existing ? "Save" : "Create goal"}</button>`,
    onMount: (node, overlay) => {
      node.addEventListener("click", (event) => {
        const color = event.target.closest("[data-color]");
        if (color) {
          colorChoice = color.dataset.color;
          node.querySelectorAll("[data-color]").forEach((dot) => dot.classList.toggle("is-active", dot === color));
        }
        const pick = event.target.closest("[data-icon]");
        if (pick) {
          iconChoice = pick.dataset.icon;
          node.querySelectorAll("[data-icon]").forEach((btn) => {
            const on = btn === pick;
            btn.classList.toggle("is-active", on);
            btn.style.cssText = on ? "background:var(--accent-soft);color:var(--accent-ink)" : "";
          });
        }
      });

      const commit = () => {
        const title = $("#gl-title", node).value.trim();
        if (!title) { $("#gl-title", node).classList.add("has-error"); return; }
        const type = $("#gl-type", node).value;
        const payload = {
          title, description: $("#gl-desc", node).value.trim(), type,
          dueDate: $("#gl-due", node).value || null,
          target: Math.max(1, Number($("#gl-target", node).value) || 1),
          unit: $("#gl-unit", node).value.trim(),
          color: colorChoice, icon: iconChoice
        };
        if (existing) { updateGoal(existing.id, payload); toast({ title: "Goal updated", type: "success" }); }
        else { createGoal(payload); toast({ title: "Goal created", desc: "Add your first milestone to get moving.", type: "success" }); }
        overlay.close();
        if (typeof pendingRerender === "function") pendingRerender();
      };
      $("#gl-save", node).addEventListener("click", commit);
      $("#gl-title", node).addEventListener("keydown", (event) => { if (event.key === "Enter") commit(); });

      const remove = $("#gl-delete", node);
      if (remove) {
        remove.addEventListener("click", async () => {
          const ok = await confirmDialog({ title: "Delete goal?", message: `“${existing.title}” will be removed permanently.`, confirmLabel: "Delete", danger: true });
          if (ok) {
            deleteGoal(existing.id);
            overlay.close();
            toast({ title: "Goal deleted", type: "info" });
            if (typeof pendingRerender === "function") pendingRerender();
          }
        });
      }
    }
  });
}

/* --GOALS-END-- */

/* ------------------------------------------------------------------- Mount */
function addMilestonePrompt(goalId, rerender) {
  modal({
    title: "Add milestone",
    subtitle: "A small, verifiable step.",
    body: `<label class="field"><span class="field__label">Milestone</span>
      <input class="input" id="ms-title" maxlength="70" placeholder="e.g. Beta with 20 users" autofocus /></label>`,
    size: "sm",
    footer: `<button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="ms-save">Add</button>`,
    onMount: (node, overlay) => {
      const save = () => {
        const title = $("#ms-title", node).value.trim();
        if (!title) return;
        addMilestone(goalId, title);
        overlay.close();
        toast({ title: "Milestone added", type: "success", duration: 1500 });
        if (typeof rerender === "function") rerender();
      };
      $("#ms-save", node).addEventListener("click", save);
      $("#ms-title", node).addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
    }
  });
}

export function mount(root, { rerender } = {}) {
  pendingRerender = rerender;

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    const goal = action.dataset.goal ? getGoal(action.dataset.goal) : null;
    switch (action.dataset.act) {
      case "new-goal":
        goalModal();
        break;
      case "goal-mile":
        if (goal) toggleMilestone(goal.id, action.dataset.mile);
        if (typeof rerender === "function") rerender();
        break;
      case "goal-step":
        if (goal) {
          const next = clamp((goal.current || 0) + Number(action.dataset.step), 0, goal.target || 999999);
          setGoalProgress(goal.id, next);
          if (next >= (goal.target || 0)) toast({ title: "Goal reached", desc: goal.title, type: "success" });
        }
        if (typeof rerender === "function") rerender();
        break;
      case "goal-add-mile":
        if (goal) addMilestonePrompt(goal.id, rerender);
        break;
      case "goal-menu":
        if (!goal) break;
        menu(action, [
          { label: "Edit goal", icon: "pencil", onClick: () => goalModal(goal) },
          { label: "Add milestone", icon: "milestone", onClick: () => addMilestonePrompt(goal.id, rerender) },
          { label: goal.status === "completed" ? "Reopen goal" : "Mark complete", icon: "check-circle", onClick: () => { updateGoal(goal.id, { status: goal.status === "completed" ? "active" : "completed" }); if (typeof rerender === "function") rerender(); } },
          { type: "sep" },
          {
            label: "Delete goal", icon: "trash", danger: true, onClick: async () => {
              const ok = await confirmDialog({ title: "Delete goal?", message: `“${goal.title}” will be removed permanently.`, confirmLabel: "Delete", danger: true });
              if (ok) { deleteGoal(goal.id); toast({ title: "Goal deleted", type: "info" }); if (typeof rerender === "function") rerender(); }
            }
          }
        ]);
        break;
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "goals",
  title: "Goals",
  icon: "target",
  group: "Grow",
  order: 1,
  nav: false,
  render,
  mount
}];

