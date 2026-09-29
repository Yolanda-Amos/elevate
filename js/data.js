/* ==========================================================================
   Elevate — Seed data. Realistic sample content so the app feels alive on
   first launch. All dates are relative to "today" so the demo never goes stale.
   ========================================================================== */
import { uid, todayISO, addDays, toISO } from "./utils.js";

const iso = (offset) => addDays(todayISO(), offset);
const ts = (daysAgo, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.getTime();
};
const tsToIso = (daysAgo) => toISO(new Date(Date.now() - daysAgo * 86400000));

export const SEED_VERSION = 4;

export const DEMO_TEAM = [
  { id: "u_me", name: "Amara Okonkwo", email: "amara@elevate.app", role: "Owner", color: "#5b5bd6" },
  { id: "u_tunde", name: "Tunde Bello", email: "tunde@elevate.app", role: "Admin", color: "#0f8a83" },
  { id: "u_zara", name: "Zara Ahmed", email: "zara@elevate.app", role: "Member", color: "#c8437c" },
  { id: "u_leo", name: "Leo Mensah", email: "leo@elevate.app", role: "Member", color: "#c07409" },
  { id: "u_nia", name: "Nia Carter", email: "nia@elevate.app", role: "Viewer", color: "#2f6fd0" }
];

const projectDefs = [
  { key: "p_website", name: "Website Redesign", icon: "grid", color: "#5b5bd6", deadline: iso(21),
    description: "Rebuild the marketing site with a calmer, faster experience and a refreshed design system." },
  { key: "p_product", name: "Product Launch", icon: "trending", color: "#159a63", deadline: iso(45),
    description: "Ship Elevate v2: new onboarding, AI planning and team workspaces." },
  { key: "p_personal", name: "Personal Growth", icon: "target", color: "#c07409", deadline: iso(90),
    description: "Reading, fitness and finances — the long game." },
  { key: "p_client", name: "Northwind Client Work", icon: "wallet", color: "#0f8a83", deadline: iso(12),
    description: "Q3 retainer: research sprint, analytics dashboard and monthly reporting." },
  { key: "p_learning", name: "Design Systems Study", icon: "book", color: "#2f6fd0", deadline: iso(30),
    description: "Deep dive into tokens, accessibility and component governance." }
];

const sectionDefs = [
  { key: "s_backlog", project: "p_website", name: "Backlog", order: 0 },
  { key: "s_design", project: "p_website", name: "Design", order: 1 },
  { key: "s_build", project: "p_website", name: "Build", order: 2 },
  { key: "s_research", project: "p_product", name: "Research", order: 0 },
  { key: "s_launch", project: "p_product", name: "Launch prep", order: 1 },
  { key: "s_health", project: "p_personal", name: "Health", order: 0 },
  { key: "s_money", project: "p_personal", name: "Money", order: 1 },
  { key: "s_client", project: "p_client", name: "Delivery", order: 0 }
];

export const TAG_DEFS = [
  { key: "t_work", name: "work", color: "#5b5bd6" },
  { key: "t_personal", name: "personal", color: "#c07409" },
  { key: "t_school", name: "school", color: "#2f6fd0" },
  { key: "t_urgent", name: "urgent", color: "#cf3b45" },
  { key: "t_finance", name: "finance", color: "#159a63" },
  { key: "t_health", name: "health", color: "#0f8a83" },
  { key: "t_deepwork", name: "deepwork", color: "#c8437c" },
  { key: "t_meeting", name: "meeting", color: "#4d5461" }
];

/* Task definitions: [title, dueOffset, priority, projectKey, sectionKey, tags, estimateMinutes, subtasks, notes] */
const taskDefs = [
  ["Review Q3 analytics dashboard spec", 0, "high", "p_client", "s_client", ["work", "deepwork"], 90, ["Skim the data model doc", "Note open questions"], "Focus on the funnel section — stakeholders care most about activation."],
  ["Submit project report", 0, "urgent", "p_client", "s_client", ["work", "urgent"], 45, ["Pull numbers from the sheet", "Write the summary"], "Client expects the PDF by 4pm."],
  ["Design review with Zara", 0, "medium", "p_website", "s_design", ["work", "meeting"], 60, [], "Walk through the new tokens and the empty states."],
  ["Draft newsletter for the launch", 1, "medium", "p_product", "s_launch", ["work"], 75, ["Outline", "Write intro", "Edit pass"], ""],
  ["Weekly review & plan next week", 2, "medium", "p_personal", null, ["personal"], 60, ["Clear inbox", "Review goals", "Plan top 3"], "Sunday ritual. Keep it to an hour."],
  ["Fix onboarding tooltip overflow", 1, "high", "p_product", "s_launch", ["work"], 40, [], "Reported on mobile Safari at 360px width."],
  ["Read 30 pages — Thinking in Systems", 0, "low", "p_personal", null, ["personal", "health"], 45, [], ""],
  ["Call Sarah about the partnership", -1, "urgent", "p_client", "s_client", ["work", "urgent"], 30, [], "Follow up on the pricing proposal sent last week."],
  ["Prepare board deck outline", 3, "high", "p_product", "s_launch", ["work", "deepwork"], 120, ["Metrics slide", "Highlights slide", "Risks slide"], ""],
  ["Refactor task list rendering", 4, "medium", "p_product", "s_launch", ["work"], 150, ["Extract row component", "Add tests"], "Keep the diff small and reviewable."],
  ["Interview 3 users for the redesign", 5, "medium", "p_website", "s_research", ["work"], 90, [], "Recruit from the beta list."],
  ["Renew domain and hosting", 6, "high", "p_personal", "s_money", ["finance", "personal"], 20, [], "Auto-renew is off — do it manually."],
  ["Write design system docs page", 7, "medium", "p_learning", null, ["school", "deepwork"], 110, ["Tokens", "Components", "Accessibility notes"], ""],
  ["Pay quarterly tax estimate", 8, "urgent", "p_personal", "s_money", ["finance", "urgent"], 30, [], "Do not miss the filing window."],
  ["Book dentist appointment", 9, "low", "p_personal", "s_health", ["health", "personal"], 10, [], ""],
  ["Plan anniversary dinner", 10, "medium", "p_personal", null, ["personal"], 30, [], "Somewhere quiet, no screens."],
  ["Audit colour contrast on marketing pages", 12, "medium", "p_website", "s_build", ["work"], 60, [], "Target WCAG AA everywhere."],
  ["Set up weekly team standup notes", 13, "low", "p_product", null, ["work", "meeting"], 25, [], ""],
  ["Update portfolio case study", 16, "low", "p_learning", null, ["personal", "school"], 90, [], ""],
  ["Run accessibility audit on the app shell", 18, "medium", "p_learning", null, ["work"], 120, ["Keyboard pass", "Screen reader pass"], ""],
  ["Prepare fall internship applications", 20, "medium", "p_learning", null, ["school"], 60, ["Shortlist 5 roles", "Tailor CV"], ""],
  ["Archive old client files", 0, "none", "p_client", "s_client", ["work"], 20, [], ""],
  ["Reply to design community thread", 0, "low", "p_learning", null, ["personal"], 10, [], ""],
  ["Pick up dry cleaning", 0, "none", "p_personal", null, ["personal"], 15, [], ""],
  ["Sketch onboarding illustrations", 2, "medium", "p_website", "s_design", ["work"], 90, [], ""],
  ["Test dark mode across views", 2, "high", "p_product", "s_launch", ["work", "deepwork"], 70, [], "Every view, both themes, mobile included."],
  ["Send invoice to Northwind", -2, "urgent", "p_client", "s_client", ["finance", "urgent"], 15, [], ""],
  ["Outline habit tracker improvements", 4, "low", "p_product", "s_research", ["work"], 45, [], ""],
  ["Build analytics empty states", 5, "medium", "p_product", "s_launch", ["work"], 80, [], ""],
  ["Clean up old branches", 3, "none", "p_product", "s_launch", ["work"], 15, [], ""],
  ["Read email newsletter backlog", 1, "low", "p_personal", null, ["personal"], 20, [], ""],
  ["Draft personal OKRs for Q4", 11, "high", "p_personal", null, ["personal"], 60, [], ""],
  ["Study 45 minutes of TypeScript generics", 0, "medium", "p_learning", null, ["school", "deepwork"], 45, [], ""],
  ["Water the plants", 0, "none", "p_personal", "s_health", ["personal"], 10, [], ""],
  ["Prep questions for mentorship call", 1, "medium", "p_learning", null, ["school"], 25, [], ""],
  ["Compress hero images", 6, "low", "p_website", "s_build", ["work"], 30, [], ""],
  ["Write release notes for v1.9", 7, "medium", "p_product", "s_launch", ["work"], 45, [], ""],
  ["Review pull request #482", 0, "high", "p_website", "s_build", ["work"], 35, [], "Focus on the state handling changes."],
  ["Plan monthly budget review", 14, "medium", "p_personal", "s_money", ["finance"], 45, [], ""],
  ["Organise notes into folders", 0, "low", "p_learning", null, ["personal"], 30, [], ""]
];

const doneTaskDefs = [
  ["Ship new sidebar navigation", "p_website", "s_build", ["work"], 140, 1],
  ["Write project brief", "p_website", "s_backlog", ["work", "deepwork"], 60, 2],
  ["Set up analytics events", "p_client", "s_client", ["work"], 90, 2],
  ["Morning run — 5km", "p_personal", "s_health", ["health"], 35, 1],
  ["Fix login redirect bug", "p_product", "s_launch", ["work"], 50, 3],
  ["Weekly planning session", "p_personal", null, ["personal"], 45, 3],
  ["Design tokens audit", "p_website", "s_design", ["work", "deepwork"], 100, 4],
  ["Publish blog draft", "p_learning", null, ["work", "school"], 120, 4],
  ["Clear support backlog", "p_client", "s_client", ["work"], 65, 5],
  ["Meal prep for the week", "p_personal", "s_health", ["personal", "health"], 55, 5],
  ["Team retro notes", "p_product", null, ["work", "meeting"], 40, 6],
  ["Read 40 pages", "p_personal", null, ["personal"], 40, 6],
  ["Invoice reconciliation", "p_personal", "s_money", ["finance"], 35, 7],
  ["Prototype kanban drag states", "p_product", "s_research", ["work"], 85, 8],
  ["Interview transcript summaries", "p_website", "s_research", ["work"], 70, 9],
  ["Grocery run", "p_personal", null, ["personal"], 45, 10],
  ["Update CV bullet points", "p_learning", null, ["school"], 50, 11],
  ["Refine dashboard greeting copy", "p_product", "s_launch", ["work"], 25, 12]
];

/** Optional attachments for a few tasks. */
const attachmentDefs = {
  "Submit project report": [{ name: "northwind-q3-report.pdf", size: 428000, type: "application/pdf" }],
  "Prepare board deck outline": [{ name: "board-metrics.xlsx", size: 96500, type: "application/vnd.ms-excel" }],
  "Design review with Zara": [{ name: "tokens-v2.png", size: 1240000, type: "image/png" }]
};

/* Deep-work block templates used by the time-blocking view. */
export const BLOCK_TEMPLATES = [
  { label: "Deep Work", start: "09:00", end: "10:30", color: "#5b5bd6" },
  { label: "Email & Admin", start: "10:30", end: "11:00", color: "#2f6fd0" },
  { label: "Project Work", start: "11:00", end: "12:00", color: "#159a63" },
  { label: "Lunch", start: "12:30", end: "13:15", color: "#c07409" },
  { label: "Meetings", start: "14:00", end: "15:00", color: "#0f8a83" },
  { label: "Review & Plan", start: "16:00", end: "16:45", color: "#c8437c" }
];

export const AMBIENT_SOUNDS = [
  { id: "brown", name: "Brown noise", icon: "waves" },
  { id: "rain", name: "Soft rain", icon: "droplet" },
  { id: "cafe", name: "Café hum", icon: "coffee" },
  { id: "forest", name: "Forest air", icon: "leaf" }
];

export function buildSeed() {
  const theTeam = DEMO_TEAM.map((u) => ({ ...u }));

  const projects = projectDefs.map((p, index) => ({
    id: p.key,
    name: p.name,
    description: p.description,
    color: p.color,
    icon: p.icon,
    deadline: p.deadline,
    members: ["u_me", ...theTeam.filter((t) => t.id !== "u_me").slice(0, 2 + (index % 2)).map((t) => t.id)],
    notes: index === 0 ? "Design principles: calm surfaces, one accent, generous spacing." : "",
    favorite: index < 2,
    archived: false,
    createdBy: "u_me",
    createdAt: ts(40 + index, 9),
    order: index
  }));

  const sections = sectionDefs.map((s, index) => ({
    id: s.key, projectId: s.project, name: s.name, order: s.order, createdAt: ts(35 + index)
  }));

  const tags = TAG_DEFS.map((t) => ({ id: t.key, name: t.name, color: t.color, createdAt: ts(45) }));

  const columns = [
    { id: "col_backlog", name: "Backlog", order: 0 },
    { id: "col_todo", name: "To Do", order: 1 },
    { id: "col_progress", name: "In Progress", order: 2 },
    { id: "col_review", name: "Review", order: 3 },
    { id: "col_done", name: "Completed", order: 4 }
  ];
  const columnFor = (index) => columns[[1, 2, 3, 1, 0, 2, 1, 2, 1, 0, 2, 3][index % 12]].id;
  const tagIds = (names) => names.map((n) => tags.find((t) => t.name === n)?.id).filter(Boolean);

  const tasks = [];
  let seq = 0;

  taskDefs.forEach((def, i) => {
    const [title, dueOffset, priority, projectKey, sectionKey, tagNames, estimated, subtasks, notes] = def;
    seq += 1;
    const done = i % 11 === 7;
    const dueDate = iso(dueOffset);
    const previous = tasks[tasks.length - 1];
    tasks.push({
      id: uid("task"),
      title,
      description: notes || "",
      notes: "",
      status: done ? "done" : "todo",
      completedAt: done ? ts(Math.max(0, -dueOffset) + 1, 14) : null,
      createdAt: ts(12 - (i % 10), 8 + (i % 8)),
      updatedAt: ts(i % 6, 12),
      dueDate,
      dueTime: ["09:00", "10:30", "13:00", "15:30", "17:00", null, null][i % 7],
      priority,
      projectId: projectKey,
      sectionId: sectionKey,
      columnId: done ? "col_done" : columnFor(i),
      tagIds: tagIds(tagNames),
      subtasks: (subtasks || []).map((t, si) => ({ id: uid("sub"), title: t, done: si === 0 && i % 3 === 0 })),
      attachments: attachmentDefs[title] ? attachmentDefs[title].map((a) => ({ id: uid("att"), ...a, addedAt: ts(2) })) : [],
      estimatedMinutes: estimated,
      actualMinutes: done ? estimated + (i % 3) * 10 : 0,
      recurrence: i === 4 ? { freq: "weekly", interval: 1 } : i === 33 ? { freq: "daily", interval: 1 } : null,
      reminder: i % 4 === 0 ? 15 : null,
      location: i === 2 ? "Google Meet" : i === 34 ? "Community Library" : "",
      dependsOn: i === 8 && previous ? [previous.id] : [],
      comments: i % 5 === 0 ? [
        { id: uid("cm"), authorId: "u_zara", text: "Dropped a first pass in the shared folder — feedback welcome.", at: ts(1, 16) },
        { id: uid("cm"), authorId: "u_me", text: "Looks great. I'll tighten the numbers section today.", at: ts(0, 9) }
      ] : [],
      assignees: i % 3 === 0 ? ["u_me", "u_tunde"] : ["u_me"],
      createdBy: "u_me",
      myDay: dueOffset === 0 && i % 3 !== 2,
      order: i,
      timeBlock: i % 5 === 0
        ? { date: dueDate, start: ["09:00", "11:00", "13:30", "15:00"][i % 4], end: ["10:00", "12:00", "14:15", "16:00"][i % 4] }
        : null,
      archived: false,
      snoozedUntil: null
    });
  });

  doneTaskDefs.forEach((def, i) => {
    const [title, projectKey, sectionKey, tagNames, estimated, daysAgo] = def;
    tasks.push({
      id: uid("task"),
      title,
      description: "",
      notes: "",
      status: "done",
      completedAt: ts(daysAgo, 11 + (i % 9)),
      createdAt: ts(daysAgo + 4, 9),
      updatedAt: ts(daysAgo, 12),
      dueDate: tsToIso(daysAgo),
      dueTime: ["09:00", "11:00", "14:00", null][i % 4],
      priority: ["high", "medium", "low", "none"][i % 4],
      projectId: projectKey,
      sectionId: sectionKey,
      columnId: "col_done",
      tagIds: tagIds(tagNames),
      subtasks: [],
      attachments: [],
      estimatedMinutes: estimated,
      actualMinutes: estimated + (i % 4) * 8,
      recurrence: null,
      reminder: null,
      location: "",
      dependsOn: [],
      comments: [],
      assignees: ["u_me"],
      createdBy: "u_me",
      myDay: false,
      order: 100 + i,
      timeBlock: null,
      archived: false,
      snoozedUntil: null
    });
  });

  return { theTeam, projects, sections, tags, columns, tasks };
}




