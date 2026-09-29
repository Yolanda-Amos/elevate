/* ==========================================================================
   Elevate — Onboarding: a short, elegant setup that personalises the app
   ========================================================================== */
import { $, escapeHtml, uid, todayISO, addDays } from "../utils.js";
import { icon } from "../icons.js";
import { toast } from "../ui.js";
import {
  completeOnboarding, updateProfile, updatePreferences, createProject, createHabit, createTask,
  getState, updateUi, createTag, getTags
} from "../store.js";
import { navigate } from "../router.js";

const QUESTIONS = [
  {
    key: "intent",
    title: "What are you hoping to accomplish?",
    sub: "Pick the one that fits best — you can change everything later.",
    multiple: false,
    options: [
      { value: "focus", icon: "target", title: "Stay focused on what matters", desc: "Fewer, better tasks with deep work blocks." },
      { value: "organise", icon: "columns", title: "Get organised", desc: "Everything captured, sorted and findable." },
      { value: "balance", icon: "leaf", title: "Find a calmer rhythm", desc: "Habits, breaks and sustainable pacing." },
      { value: "team", icon: "users", title: "Work better with my team", desc: "Shared projects, clear ownership." }
    ]
  },
  {
    key: "workType",
    title: "What type of work do you do?",
    sub: "This shapes the sample projects and planning defaults.",
    multiple: false,
    options: [
      { value: "design", icon: "grid", title: "Design / creative", desc: "Iterative work, reviews and craft." },
      { value: "engineering", icon: "layout", title: "Engineering", desc: "Sprints, reviews and shipping." },
      { value: "founder", icon: "trending", title: "Founder / operator", desc: "Many hats, constant context switching." },
      { value: "student", icon: "book", title: "Student / researcher", desc: "Deadlines, reading and study blocks." }
    ]
  },
  {
    key: "areas",
    title: "What are your main areas of responsibility?",
    sub: "Choose as many as you like.",
    multiple: true,
    options: [
      { value: "work", icon: "tasks", title: "Work", desc: "Projects, clients, deliverables." },
      { value: "personal", icon: "heart", title: "Personal", desc: "Home, family, admin." },
      { value: "health", icon: "dumbbell", title: "Health & habits", desc: "Movement, sleep, routines." },
      { value: "learning", icon: "book", title: "Learning", desc: "Courses, reading, side projects." },
      { value: "finance", icon: "wallet", title: "Finance", desc: "Bills, budgets, planning." },
      { value: "creative", icon: "spark", title: "Creative work", desc: "Writing, music, making things." }
    ]
  },
  {
    key: "organizePref",
    title: "How do you prefer to organise tasks?",
    sub: "Your default view is set from this answer.",
    multiple: false,
    options: [
      { value: "list", icon: "list", title: "Simple lists", desc: "One column, sorted by date." },
      { value: "board", icon: "kanban", title: "Boards", desc: "Move work through stages." },
      { value: "calendar", icon: "calendar", title: "Calendar", desc: "Plan by time of day." },
      { value: "hybrid", icon: "layout", title: "A mix of everything", desc: "Lists, boards and calendar." }
    ]
  },
  {
    key: "productivityGoals",
    title: "What are your productivity goals?",
    sub: "We will track these on your dashboard.",
    multiple: true,
    options: [
      { value: "deepwork", icon: "timer", title: "More deep work", desc: "Protect 2+ focused hours daily." },
      { value: "fewer-overdue", icon: "alert", title: "Fewer overdue tasks", desc: "Keep deadlines honest." },
      { value: "habits", icon: "repeat", title: "Build lasting habits", desc: "Consistency over intensity." },
      { value: "balance", icon: "coffee", title: "Healthier balance", desc: "Breaks, boundaries, recovery." }
    ]
  }
];

/* --------------------------------------------------------------- Rendering */
const answers = { areas: [], productivityGoals: [], intent: "", workType: "", organizePref: "" };
let stepIndex = 0;

const stepMarkup = (step) => `
  <div class="onb__options">
    ${step.options.map((option) => {
      const selected = step.multiple ? answers[step.key].includes(option.value) : answers[step.key] === option.value;
      return `
        <button class="onb__option${selected ? " is-active" : ""}" type="button"
          data-answer="${escapeHtml(option.value)}" data-multiple="${step.multiple ? "1" : "0"}">
          <span class="onb__option-icon">${icon(option.icon, 16)}</span>
          <span class="grow">
            <span class="onb__option-title">${escapeHtml(option.title)}</span>
            <span class="onb__option-desc">${escapeHtml(option.desc)}</span>
          </span>
          <span class="onb__tick">${icon("check", 15)}</span>
        </button>`;
    }).join("")}
  </div>`;

function renderStep(root) {
  const step = QUESTIONS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === QUESTIONS.length - 1;
  const answered = step.multiple ? answers[step.key].length > 0 : Boolean(answers[step.key]);

  root.innerHTML = `
    <div class="onb" role="dialog" aria-modal="true" aria-label="Welcome to Elevate">
      <div class="onb__card">
        <div class="onb__brand">
          <span class="brand__mark" style="width:30px;height:30px">${icon("sparkles", 16)}</span>
          <span class="brand__name" style="font-size:var(--fs-md)">Elevate</span>
          <span class="badge badge--accent" style="margin-left:auto">Setup ${stepIndex + 1} of ${QUESTIONS.length}</span>
        </div>
        <h1 class="onb__title">${escapeHtml(step.title)}</h1>
        <p class="onb__sub">${escapeHtml(step.sub)}</p>
        <div class="onb__body" data-step-body>${stepMarkup(step)}</div>
        <div class="onb__foot">
          ${isFirst
    ? '<button class="btn btn--ghost" type="button" data-skip>Skip setup</button>'
    : `<button class="btn btn--ghost" type="button" data-back>${icon("chevron-left", 15)} Back</button>`}
          <div class="onb__steps">
            ${QUESTIONS.map((_, i) => `<span class="onb__dot${i === stepIndex ? " is-active" : ""}"></span>`).join("")}
          </div>
          <button class="btn btn--primary" type="button" data-next ${answered ? "" : "disabled"}>
            ${isLast ? "Finish setup" : "Continue"} ${isLast ? icon("check", 15) : icon("arrow-right", 15)}
          </button>
        </div>
      </div>
    </div>`;

}

/* ------------------------------------------------------- Personalisation */
function buildStarterContent() {
  const areas = answers.areas.length ? answers.areas : ["work", "personal"];

  const projects = {
    work: { name: "Work", color: "#5b5bd6", icon: "tasks", description: "Everything professional that needs a home." },
    personal: { name: "Personal", color: "#c07409", icon: "heart", description: "Life admin, home and family." },
    health: { name: "Health & habits", color: "#159a63", icon: "dumbbell", description: "Movement, sleep and recovery." },
    learning: { name: "Learning", color: "#2f6fd0", icon: "book", description: "Courses, reading and practice." },
    finance: { name: "Finance", color: "#0f8a83", icon: "wallet", description: "Bills, budgets and planning." },
    creative: { name: "Creative work", color: "#c8437c", icon: "spark", description: "Side projects worth protecting." }
  };

  const existing = getState().projects.map((p) => p.name.toLowerCase());
  const projectIds = {};
  areas.forEach((area) => {
    const meta = projects[area];
    if (!meta) return;
    const match = getState().projects.find((p) => p.name.toLowerCase() === meta.name.toLowerCase());
    if (match) { projectIds[area] = match.id; return; }
    if (existing.includes(meta.name.toLowerCase())) return;
    projectIds[area] = createProject({ ...meta }).id;
  });

  ["work", "personal", "health", "finance", "learning", "creative"].forEach((name) => {
    if (areas.includes(name) && !getTags().some((t) => t.name === name)) createTag(name);
  });

  const starters = [
    { area: "work", title: "Plan my week", priority: "high", estimate: 45, subtasks: ["Review last week", "Pick 3 priorities", "Block focus time"] },
    { area: "work", title: "Clear the inbox", priority: "medium", estimate: 25 },
    { area: "personal", title: "Tidy my workspace", priority: "low", estimate: 20 },
    { area: "health", title: "Move for 30 minutes", priority: "medium", estimate: 30 },
    { area: "learning", title: "Read for 30 minutes", priority: "low", estimate: 30 },
    { area: "finance", title: "Review this month's spending", priority: "medium", estimate: 25 },
    { area: "creative", title: "Make something just for fun", priority: "low", estimate: 60 }
  ];

  starters.forEach((starter, index) => {
    if (!areas.includes(starter.area)) return;
    createTask({
      title: starter.title,
      priority: starter.priority,
      estimatedMinutes: starter.estimate,
      projectId: projectIds[starter.area] || null,
      dueDate: index === 0 ? todayISO() : addDays(todayISO(), (index % 3) + 1),
      myDay: index === 0,
      tagIds: getTags().filter((t) => t.name === starter.area).map((t) => t.id),
      subtasks: (starter.subtasks || []).map((subtitle) => ({ id: uid("sub"), title: subtitle, done: false }))
    });
  });

  const wanted = areas.flatMap((area) => ({
    health: ["Exercise", "Drink water"],
    learning: ["Read", "Study"],
    personal: ["Journal"],
    work: ["Study"]
  }[area] || []));
  wanted
    .filter((name) => !getState().habits.some((habit) => habit.name === name))
    .forEach((name) => createHabit({ name, target: 1, unit: "session" }));
}

function finish(skipped = false) {
  if (!skipped) {
    buildStarterContent();
    updateProfile({
      goals: answers.intent ? [answers.intent] : [],
      workType: answers.workType,
      areas: answers.areas,
      organizePref: answers.organizePref,
      productivityGoals: answers.productivityGoals
    });
    updatePreferences({
      defaultView: answers.organizePref === "board" ? "board" : answers.organizePref === "calendar" ? "calendar" : "list"
    });
  }
  completeOnboarding({});
  const root = document.querySelector("#onboarding");
  if (root) root.innerHTML = "";
  toast({
    title: skipped ? "You're all set" : "Workspace ready",
    desc: skipped ? "Add sample data any time in Settings → Data." : "Start with one quick task — or add sample data in Settings.",
    type: "success"
  });
  updateUi({ lastRoute: "dashboard", taskView: answers.organizePref === "board" ? "board" : "list" });
  navigate("dashboard");
}

function handleStepEvent(event, root) {
  const option = event.target.closest("[data-answer]");
  if (option) {
    const { answer, multiple } = option.dataset;
    const current = QUESTIONS[stepIndex];
    if (multiple === "1") {
      const list = answers[current.key];
      answers[current.key] = list.includes(answer) ? list.filter((a) => a !== answer) : [...list, answer];
    } else {
      answers[current.key] = answer;
    }
    renderStep(root);
    return;
  }
  if (event.target.closest("[data-next]")) {
    if (stepIndex === QUESTIONS.length - 1) finish(false);
    else { stepIndex += 1; renderStep(root); }
    return;
  }
  if (event.target.closest("[data-back]") && stepIndex > 0) {
    stepIndex -= 1;
    renderStep(root);
    return;
  }
  if (event.target.closest("[data-skip]")) finish(true);
}

export function startOnboarding() {
  stepIndex = 0;
  const root = document.querySelector("#onboarding");
  if (!root) return;
  root.innerHTML = "";
  root.onclick = (event) => handleStepEvent(event, root);
  renderStep(root);
}

export const onboarded = () => Boolean(getState() && getState().onboarded);


