/* ==========================================================================
   Elevate — Natural language task parsing
   "Submit project report tomorrow at 10am" → title/date/time/priority/tags
   ========================================================================== */
import { todayISO, addDays, parseISO, toISO, formatDate, formatTime, pad } from "./utils.js";

const WEEKDAY_ALIASES = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6
};

const MONTH_ALIASES = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

const PRIORITY_WORDS = [
  { re: /\b(urgent|asap|critical|!1|p1)\b/i, value: "urgent" },
  { re: /\b(high priority|important|!2|p2)\b/i, value: "high" },
  { re: /\b(medium priority|!3|p3)\b/i, value: "medium" },
  { re: /\b(low priority|whenever|someday|!4|p4)\b/i, value: "low" },
  { re: /\b(no priority|!0|p0)\b/i, value: "none" }
];

const RECURRENCE_RULES = [
  { re: /\b(every day|daily|each day)\b/i, value: { freq: "daily", interval: 1 }, label: "every day" },
  { re: /\b(every weekday|weekdays|on weekdays)\b/i, value: { freq: "weekdays", interval: 1, byDay: [1, 2, 3, 4, 5] }, label: "every weekday" },
  { re: /\b(every weekend)\b/i, value: { freq: "weekly", interval: 1, byDay: [0, 6] }, label: "every weekend" },
  { re: /\b(every week|weekly)\b/i, value: { freq: "weekly", interval: 1 }, label: "every week" },
  { re: /\b(every month|monthly)\b/i, value: { freq: "monthly", interval: 1 }, label: "every month" },
  { re: /\b(every year|yearly|annually)\b/i, value: { freq: "yearly", interval: 1 }, label: "every year" },
  { re: /\bevery (\d+) (?:days|day)\b/i, dynamic: (m) => ({ freq: "daily", interval: Number(m[1]) }), label: (m) => `every ${m[1]} days` },
  { re: /\bevery (\d+) weeks?\b/i, dynamic: (m) => ({ freq: "weekly", interval: Number(m[1]) }), label: (m) => `every ${m[1]} weeks` }
];

function nthWeekday(fromISO, weekday, { next = false, ordinal = 1 } = {}) {
  const base = parseISO(fromISO);
  const delta = (weekday - base.getDay() + 7) % 7;
  let target = addDays(fromISO, delta);
  if (next && delta === 0) target = addDays(target, 7);
  if (ordinal > 1) target = addDays(target, 7 * (ordinal - 1));
  return target;
}

const isWeekendISO = (value) => [0, 6].includes(parseISO(value).getDay());

/** Parses free text into structured task fields plus a human summary. */
export function parseTaskInput(input = "", ctx = {}) {
  const today = ctx.today || todayISO();
  let text = ` ${String(input).trim()} `;
  const result = { dueDate: null, dueTime: null, recurrence: null, priority: null, tagNames: [], estimate: null, location: "" };
  const matched = [];

  const consume = (re, onMatch) => {
    const m = text.match(re);
    if (!m) return null;
    const value = onMatch(m);
    text = text.replace(m[0], " ");
    matched.push(m[0].trim());
    return value;
  };

  /* Tags: #work */
  text = text.replace(/#([\w-]+)/g, (all, name) => {
    result.tagNames.push(String(name).toLowerCase());
    matched.push(all);
    return " ";
  });

  /* Priority */
  PRIORITY_WORDS.forEach((rule) => {
    if (result.priority) return;
    const value = consume(rule.re, () => rule.value);
    if (value) result.priority = value;
  });

  /* Recurrence: "every Monday", "daily", "every 2 weeks" */
  RECURRENCE_RULES.forEach((rule) => {
    if (result.recurrence) return;
    const value = consume(rule.re, (m) => (rule.dynamic ? rule.dynamic(m) : rule.value));
    if (value) {
      result.recurrence = value;
      result.recurrenceLabel = typeof rule.label === "function" ? rule.label(value.freq === "daily" ? [1] : [1]) : rule.label;
    }
  });
  if (!result.recurrence) {
    const weekdayRe = new RegExp(`\\bevery\\s+(${Object.keys(WEEKDAY_ALIASES).join("|")})\\b`, "i");
    const value = consume(weekdayRe, (m) => {
      const day = WEEKDAY_ALIASES[m[1].toLowerCase()];
      return { freq: "weekly", interval: 1, byDay: [day], anchorDate: nthWeekday(today, day) };
    });
    if (value) {
      result.recurrence = value;
      result.recurrenceLabel = "weekly";
      result.dueDate = value.anchorDate;
    }
  }

  /* Duration estimate */
  consume(/\bfor\s+(\d+)\s*(minutes|min|mins|m)\b/i, (m) => { result.estimate = Number(m[1]); return true; });
  if (!result.estimate) consume(/\b(\d+)\s?(h|hr|hrs|hours)\b/i, (m) => { result.estimate = Number(m[1]) * 60; return true; });
  if (!result.estimate) consume(/\b(\d{2,3})\s?(min|mins|minutes)\b/i, (m) => { result.estimate = Number(m[1]); return true; });

  /* Explicit ISO date */
  consume(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => { result.dueDate = `${m[1]}-${m[2]}-${m[3]}`; return true; });

  /* "March 12" / "12 March" */
  if (!result.dueDate) {
    const months = Object.keys(MONTH_ALIASES).join("|");
    consume(new RegExp(`\\b(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"), (m) => {
      const month = MONTH_ALIASES[m[1].toLowerCase()];
      const day = Number(m[2]);
      let candidate = new Date(new Date().getFullYear(), month, day);
      if (toISO(candidate) < today) candidate = new Date(new Date().getFullYear() + 1, month, day);
      result.dueDate = toISO(candidate);
      return true;
    });
  }
  if (!result.dueDate) {
    const months = Object.keys(MONTH_ALIASES).join("|");
    consume(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${months})\\b`, "i"), (m) => {
      const month = MONTH_ALIASES[m[2].toLowerCase()];
      const day = Number(m[1]);
      let candidate = new Date(new Date().getFullYear(), month, day);
      if (toISO(candidate) < today) candidate = new Date(new Date().getFullYear() + 1, month, day);
      result.dueDate = toISO(candidate);
      return true;
    });
  }

  /* Numeric dates: 12/03 or 12/03/2027 */
  if (!result.dueDate) {
    consume(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear();
      let candidate = new Date(year, month, day);
      if (!m[3] && toISO(candidate) < today) candidate = new Date(year + 1, month, day);
      result.dueDate = toISO(candidate);
      return true;
    });
  }

  /* Relative days */
  if (!result.dueDate) {
    const relative = [
      { re: /\b(today|tonight|this evening)\b/i, get: () => today },
      { re: /\btomorrow\b/i, get: () => addDays(today, 1) },
      { re: /\bday after tomorrow\b/i, get: () => addDays(today, 2) },
      { re: /\byesterday\b/i, get: () => addDays(today, -1) },
      { re: /\bin (\d+) days?\b/i, get: (m) => addDays(today, Number(m[1])) },
      { re: /\bin (\d+) weeks?\b/i, get: (m) => addDays(today, Number(m[1]) * 7) },
      { re: /\bnext week\b/i, get: () => addDays(today, 7) },
      { re: /\bnext month\b/i, get: () => addDays(today, 30) },
      { re: /\bend of (?:the )?month\b/i, get: () => toISO(new Date(parseISO(today).getFullYear(), parseISO(today).getMonth() + 1, 0)) },
      { re: /\bthis weekend\b/i, get: () => nthWeekday(today, 6) },
      { re: /\bnext weekend\b/i, get: () => addDays(nthWeekday(today, 6), 7) }
    ];
    for (const rule of relative) {
      const value = consume(rule.re, (m) => rule.get(m));
      if (value) { result.dueDate = value; break; }
    }
  }

  /* Weekday names: "by Friday", "next Monday", "on Friday" */
  if (!result.dueDate) {
    const weekdayRe = new RegExp(`\\b(?:(next|this|by|on|due)\\s+)?(${Object.keys(WEEKDAY_ALIASES).join("|")})\\b`, "i");
    const value = consume(weekdayRe, (m) => {
      const day = WEEKDAY_ALIASES[m[2].toLowerCase()];
      return nthWeekday(today, day, { next: (m[1] || "").toLowerCase() === "next" });
    });
    if (value) result.dueDate = value;
  }

  /* Times: "at 10am", "by 9:30pm", "@ 14:00", "at 4" */
  const timeMatch =
    text.match(/\b(?:at|by|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
    text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ||
    text.match(/\b(?:at|by|@)\s*(\d{1,2})(?::(\d{2}))?\b/i);

  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridian = (timeMatch[3] || "").toLowerCase();
    if (meridian === "pm" && hours < 12) hours += 12;
    if (meridian === "am" && hours === 12) hours = 0;
    if (!meridian && hours <= 7) hours += 12; // "at 4" reads as 4pm for planning
    result.dueTime = `${pad(Math.min(hours, 23))}:${pad(minutes)}`;
    text = text.replace(timeMatch[0], " ");
    matched.push(timeMatch[0].trim());
  } else {
    const wordTimes = [
      { re: /\b(noon|midday)\b/i, value: "12:00" },
      { re: /\bmidnight\b/i, value: "23:59" },
      { re: /\bmorning\b/i, value: "09:00" },
      { re: /\bafternoon\b/i, value: "14:00" },
      { re: /\b(tonight|evening)\b/i, value: "20:00" }
    ];
    for (const rule of wordTimes) {
      const value = consume(rule.re, () => rule.value);
      if (value) { result.dueTime = value; break; }
    }
  }

  /* Location: "at the office", "in Lagos" — only if no time was captured */
  if (!result.dueTime) {
    const location = text.match(/\b(?:at|in)\s+(?:the\s+)?([A-Z][\w'-]{2,}(?:\s+[A-Z][\w'-]+)*)\b/);
    if (location) {
      result.location = location[1].trim();
      text = text.replace(location[0], " ");
      matched.push(location[0].trim());
    }
  }

  /* Title cleanup */
  const title = text
    .replace(/\b(at|on|by|due|for|from|the|this|next|in|to)\b\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:•\-–—]+|[\s,;:•\-–—]+$/g, "")
    .trim();

  result.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : String(input).trim();
  result.matched = matched.filter(Boolean);
  result.summary = describe(result);
  return result;
}

/** Human-friendly summary of what the parser understood. */
export function describe(parsed) {
  const bits = [];
  if (parsed.dueDate) bits.push(formatDate(parsed.dueDate, "medium"));
  if (parsed.dueTime) bits.push(formatTime(parsed.dueTime));
  if (parsed.recurrence) {
    const { freq, interval = 1 } = parsed.recurrence;
    bits.push(interval > 1 ? `every ${interval} ${freq}` : `repeats ${freq}`);
  }
  if (parsed.priority) bits.push(`${parsed.priority} priority`);
  if (parsed.tagNames && parsed.tagNames.length) bits.push(parsed.tagNames.map((t) => `#${t}`).join(" "));
  if (parsed.estimate) bits.push(`${parsed.estimate} min`);
  if (parsed.location) bits.push(`@ ${parsed.location}`);
  return bits.join(" · ");
}

/** Next occurrence for a recurring task. */
export function nextOccurrence(dateISO, recurrence) {
  if (!recurrence || !dateISO) return null;
  const interval = recurrence.interval || 1;
  switch (recurrence.freq) {
    case "daily":
      return addDays(dateISO, interval);
    case "weekdays": {
      let next = addDays(dateISO, 1);
      while (isWeekendISO(next)) next = addDays(next, 1);
      return next;
    }
    case "weekly": {
      const days = recurrence.byDay && recurrence.byDay.length ? recurrence.byDay : [parseISO(dateISO).getDay()];
      let next = addDays(dateISO, 1);
      for (let i = 0; i < 370; i += 1) {
        if (days.includes(parseISO(next).getDay())) return next;
        next = addDays(next, 1);
      }
      return addDays(dateISO, 7 * interval);
    }
    case "monthly": {
      const d = parseISO(dateISO);
      return toISO(new Date(d.getFullYear(), d.getMonth() + interval, d.getDate()));
    }
    case "yearly": {
      const d = parseISO(dateISO);
      return toISO(new Date(d.getFullYear() + interval, d.getMonth(), d.getDate()));
    }
    default:
      return addDays(dateISO, 1);
  }
}

export const RECURRENCE_LABELS = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year"
};

/** Ready-made examples shown in the quick-add helper. */
export const NLP_EXAMPLES = [
  "Submit project report tomorrow at 10am",
  "Call Sarah every Monday at 9am",
  "Finish proposal by Friday",
  "Pay rent on the 1st #finance !urgent",
  "Team sync every weekday at 9:30am for 30 minutes"
];


