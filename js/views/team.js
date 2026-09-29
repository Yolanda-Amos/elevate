/* ==========================================================================
   Elevate — Team: members, roles, workload and workspace activity
   ========================================================================== */
import { escapeHtml, relativeTime } from "../utils.js";
import { icon } from "../icons.js";
import { emptyState, toast, modal, menu, confirmDialog, avatar, progressBar } from "../ui.js";
import { navigate } from "../router.js";
import {
  getMembers, inviteMember, updateMemberRole, removeMember, getActivity,
  currentUser, tasksByMember, getProjects, displayName
} from "../store.js";

const ROLES = ["Owner", "Admin", "Member", "Viewer"];

function memberRow(member) {
  const me = currentUser();
  const isSelf = member.id === me.id;
  const tasks = tasksByMember(member.id);
  const open = tasks.filter((task) => task.status !== "done").length;
  return `
    <div class="member-row" data-member="${member.id}">
      ${avatar(member, "")}
      <div class="member-row__meta">
        <div class="member-row__name">${escapeHtml(displayName(member))}${isSelf ? ' <span class="badge badge--accent">You</span>' : ""}</div>
        <div class="member-row__email">${member.email ? `${escapeHtml(member.email)} · ` : ""}${open} open task${open === 1 ? "" : "s"}</div>
      </div>
      <span class="tag-dot" style="background:${member.color || "var(--accent)"}"></span>
      <select class="select role-select" data-role="${member.id}" ${member.role === "Owner" ? "disabled" : ""} aria-label="Role for ${escapeHtml(displayName(member))}">
        ${ROLES.map((role) => `<option value="${role}"${member.role === role ? " selected" : ""}>${role}</option>`).join("")}
      </select>
      <button class="icon-btn" type="button" data-act="member-menu" data-member="${member.id}" data-tip="More" ${member.role === "Owner" ? "disabled" : ""}>${icon("more-h", 15)}</button>
    </div>`;
}

function workloadCard() {
  const rows = getMembers().map((member) => {
    const tasks = tasksByMember(member.id);
    return { member, total: tasks.length, done: tasks.filter((task) => task.status === "done").length };
  }).filter((row) => row.total > 0);
  if (!rows.length) return emptyState({ icon: "users", title: "No assigned tasks", text: "Assign tasks to teammates to see workload.", small: true, muted: true });
  return `<div class="col gap-3">${rows.map((row) => `
    <div>
      <div class="row-between mb-2" style="gap:10px">
        <span class="fs-xs strong">${escapeHtml(row.member.name)}</span>
        <span class="fs-xs text-3 tnum">${row.done}/${row.total} done</span>
      </div>
      ${progressBar(row.total ? (row.done / row.total) * 100 : 0, row.done === row.total ? "progress--success" : "")}
    </div>`).join("")}</div>`;
}

function activityFeed() {
  const items = getActivity().slice(0, 10);
  if (!items.length) return emptyState({ icon: "spark", title: "No activity yet", text: "Actions will show up here.", small: true, muted: true });
  return items.map((item) => {
    const member = getMembers().find((person) => person.id === item.who) || currentUser();
    return `
      <div class="activity-item">
        <span class="activity-item__dot" style="background:${member.color || "var(--accent)"}"></span>
        <div class="grow">
          <div class="fs-xs">${member.name ? `<strong>${escapeHtml(member.name.split(" ")[0])}</strong> ` : ""}${escapeHtml(item.text)}</div>
          <div class="fs-2xs text-3">${escapeHtml(relativeTime(item.at))}</div>
        </div>
      </div>`;
  }).join("");
}

export function render() {
  const members = getMembers();
  const seatLimit = 12;
  const projects = getProjects().filter((project) => !project.archived);

  return `
    <div class="col gap-5">
      <header class="page-head">
        <div class="page-head__main">
          <div class="page-head__eyebrow">Workspace</div>
          <h1>Team</h1>
          <p class="page-head__sub">My workspace · ${members.length}/${seatLimit} seats used · ${projects.length} shared projects.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-act="invite">${icon("plus", 15)} Invite member</button>
        </div>
      </header>

      <section class="stat-grid">
        <div class="team-stat"><span class="stat__icon">${icon("users", 15)}</span><div><div class="stat__value">${members.length}</div><div class="stat__label">Members</div></div></div>
        <div class="team-stat"><span class="stat__icon stat__icon--info">${icon("shield", 15)}</span><div><div class="stat__value">${members.filter((m) => m.role === "Admin" || m.role === "Owner").length}</div><div class="stat__label">Admins</div></div></div>
        <div class="team-stat"><span class="stat__icon stat__icon--success">${icon("tasks", 15)}</span><div><div class="stat__value">${members.reduce((sum, m) => sum + tasksByMember(m.id).filter((t) => t.status !== "done").length, 0)}</div><div class="stat__label">Assigned & open</div></div></div>
        <div class="team-stat"><span class="stat__icon stat__icon--warning">${icon("folder", 15)}</span><div><div class="stat__value">${projects.length}</div><div class="stat__label">Shared projects</div></div></div>
      </section>

      <div class="dash-grid">
        <section class="card card--pad">
          <div class="row-between mb-3">
            <h3 class="card-title">Members</h3>
            <span class="fs-xs text-3">${Math.max(0, seatLimit - members.length)} seats left</span>
          </div>
          ${members.map(memberRow).join("")}
        </section>
        <div class="dash-col">
          <section class="card card--pad">
            <h3 class="card-title mb-3">Workload</h3>
            ${workloadCard()}
          </section>
          <section class="card card--pad">
            <h3 class="card-title mb-3">Recent activity</h3>
            ${activityFeed()}
          </section>
        </div>
      </div>
    </div>`;
}

let pendingRerender = null;

/* -------------------------------------------------------------- Invite UI */
function inviteModal() {
  modal({
    title: "Invite a teammate",
    subtitle: "They will receive access to shared projects immediately (demo).",
    body: `
      <div class="col gap-4">
        <label class="field"><span class="field__label">Email</span>
          <input class="input" id="inv-email" type="email" placeholder="teammate@company.com" autofocus /></label>
        <label class="field"><span class="field__label">Role</span>
          <select class="select" id="inv-role">
            <option value="Member">Member — edit and comment</option>
            <option value="Admin">Admin — invite and manage</option>
            <option value="Viewer">Viewer — read only</option>
          </select></label>
      </div>`,
    footer: `<button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="inv-send">${icon("plus", 14)} Send invite</button>`,
    onMount: (node, overlay) => {
      const send = () => {
        const email = $("#inv-email", node).value.trim();
        const role = $("#inv-role", node).value;
        const member = inviteMember(email, role);
        if (!member) {
          $("#inv-email", node).classList.add("has-error");
          toast({ title: "Enter a valid email", type: "error" });
          return;
        }
        overlay.close();
        toast({ title: "Invitation sent", desc: `${email} joins as ${role}.`, type: "success" });
        if (typeof pendingRerender === "function") pendingRerender();
      };
      $("#inv-send", node).addEventListener("click", send);
      $("#inv-email", node).addEventListener("keydown", (event) => { if (event.key === "Enter") send(); });
    }
  });
}

/* ------------------------------------------------------------------- Mount */
export function mount(root, { rerender } = {}) {
  pendingRerender = rerender;

  root.addEventListener("change", (event) => {
    const select = event.target.closest("[data-role]");
    if (!select) return;
    updateMemberRole(select.dataset.role, select.value);
    toast({ title: `Role updated to ${select.value}`, type: "success", duration: 1500 });
    if (typeof rerender === "function") rerender();
  });

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-act]");
    if (!action) return;
    switch (action.dataset.act) {
      case "invite":
        inviteModal();
        break;
      case "member-menu": {
        const member = getMembers().find((item) => item.id === action.dataset.member);
        if (!member) break;
        menu(action, [
          { label: "View all tasks", icon: "tasks", onClick: () => navigate("tasks") },
          { type: "sep" },
          {
            label: "Remove from workspace", icon: "trash", danger: true, onClick: async () => {
              const ok = await confirmDialog({ title: "Remove member?", message: `${member.name} will lose access to this workspace.`, confirmLabel: "Remove", danger: true });
              if (ok) {
                const removed = removeMember(member.id);
                toast({ title: removed ? "Member removed" : "The owner cannot be removed", type: removed ? "info" : "warning" });
                if (typeof rerender === "function") rerender();
              }
            }
          }
        ]);
        break;
      }
      default:
        break;
    }
  });
}

/* ------------------------------------------------------------------ Routes */
export const routes = [{
  name: "team",
  title: "Team",
  icon: "users",
  group: "Workspace",
  order: 0,
  nav: true,
  render,
  mount
}];
