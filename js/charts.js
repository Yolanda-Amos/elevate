/* ==========================================================================
   Elevate — Charts: hand-rolled SVG output, no dependencies
   ========================================================================== */
import { escapeHtml, clamp, sum, formatNumber } from "./utils.js";

const niceMax = (value) => {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
};

/** Vertical bar chart. data: [{ label, value, muted? }] */
export function barChart(data = [], { height = 176, suffix = "", showValues = true } = {}) {
  if (!data.length) return "";
  const width = Math.max(280, data.length * 58);
  const padX = 26;
  const padTop = showValues ? 22 : 12;
  const padBottom = 26;
  const innerHeight = height - padTop - padBottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const slot = (width - padX * 2) / data.length;
  const barWidth = Math.min(38, slot * 0.56);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padTop + innerHeight * (1 - ratio);
    return `<line class="chart__grid" x1="${padX}" x2="${width - padX}" y1="${y}" y2="${y}"></line>`;
  }).join("");

  const bars = data.map((d, i) => {
    const value = Math.max(0, d.value);
    const barHeight = max ? (value / max) * innerHeight : 0;
    const x = padX + slot * i + (slot - barWidth) / 2;
    const y = padTop + innerHeight - barHeight;
    return `
      <g>
        <title>${escapeHtml(d.label)}: ${formatNumber(value)}${escapeHtml(suffix)}</title>
        <rect class="chart__bar${d.muted ? " chart__bar--muted" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
          width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, value > 0 ? 3 : 0).toFixed(1)}" rx="5"></rect>
        ${showValues && value > 0 ? `<text class="chart__value" x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${formatNumber(value)}</text>` : ""}
        <text class="chart__label" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${escapeHtml(d.label)}</text>
      </g>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" style="height:${height}px" role="img">${gridLines}${bars}</svg>`;
}

/** Area + line chart. data: [{ label, value }] */
export function lineChart(data = [], { height = 176, suffix = "", showDots = true } = {}) {
  if (data.length < 2) return "";
  const width = Math.max(300, data.length * 44);
  const padX = 22;
  const padTop = 16;
  const padBottom = 26;
  const innerHeight = height - padTop - padBottom;
  const innerWidth = width - padX * 2;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const stepX = innerWidth / (data.length - 1);
  const points = data.map((d, i) => ({
    x: padX + stepX * i,
    y: padTop + innerHeight - (max ? (d.value / max) * innerHeight : 0)
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${(padTop + innerHeight).toFixed(1)} L${points[0].x.toFixed(1)} ${(padTop + innerHeight).toFixed(1)} Z`;
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = padTop + innerHeight * (1 - ratio);
    return `<line class="chart__grid" x1="${padX}" x2="${width - padX}" y1="${y}" y2="${y}"></line>`;
  }).join("");

  const dots = showDots ? points.map((p, i) => `
    <circle class="chart__dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4">
      <title>${escapeHtml(data[i].label)}: ${formatNumber(data[i].value)}${escapeHtml(suffix)}</title>
    </circle>`).join("") : "";

  const labels = data.map((d, i) => {
    if (data.length > 10 && i % 2 === 1) return "";
    return `<text class="chart__label" x="${points[i].x.toFixed(1)}" y="${height - 8}" text-anchor="middle">${escapeHtml(d.label)}</text>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" style="height:${height}px" role="img">
    ${grid}
    <path class="chart__area" d="${area}"></path>
    <path class="chart__line" d="${line}"></path>
    ${dots}${labels}
  </svg>`;
}

/** Donut chart. segments: [{ label, value, color }] */
export function donutChart(segments = [], { size = 152, thickness = 17, centerLabel = "", centerSub = "" } = {}) {
  const total = sum(segments, (s) => s.value);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const rings = total === 0
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"></circle>`
    : segments.filter((s) => s.value > 0).map((segment) => {
      const dash = (segment.value / total) * circumference;
      const element = `
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none"
          stroke="${segment.color || "var(--accent)"}" stroke-width="${thickness}"
          stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
          stroke-dashoffset="${(-offset).toFixed(2)}"
          transform="rotate(-90 ${size / 2} ${size / 2})">
          <title>${escapeHtml(segment.label)}: ${formatNumber(segment.value)}</title>
        </circle>`;
      offset += dash;
      return element;
    }).join("");

  return `
    <span class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}</svg>
      <span class="ring__value" style="font-size:${Math.round(size / 6)}px;line-height:1.15;text-align:center">
        ${escapeHtml(centerLabel)}
        ${centerSub ? `<span style="display:block;font-size:10px;font-weight:500;color:var(--text-3)">${escapeHtml(centerSub)}</span>` : ""}
      </span>
    </span>`;
}

/** Activity heatmap. values: { 'YYYY-MM-DD': number } */
export function heatmap(values = {}, days = [], { max = 4, tooltipPrefix = "" } = {}) {
  if (!days.length) return "";
  const weeks = [];
  let current = [];
  days.forEach((date, index) => {
    current.push(date);
    if (current.length === 7 || index === days.length - 1) {
      weeks.push(current);
      current = [];
    }
  });

  const levelOf = (value) => {
    if (!value) return 0;
    if (max <= 1) return 4;
    const ratio = clamp(value / max, 0, 1);
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.85) return 3;
    return 4;
  };

  return `<div class="heat" role="img">${weeks.map((week) => `
    <div class="heat__week">
      ${week.map((date) => {
        const value = Number(values[date] || 0);
        return `<span class="heat__cell heat__cell--${levelOf(value)}" data-tip="${escapeHtml(`${tooltipPrefix}${date}: ${formatNumber(value)}`)}"></span>`;
      }).join("")}
    </div>`).join("")}</div>`;
}

/** Horizontal comparison bars. data: [{ label, value, color, meta }] */
export function hBars(data = [], { format = (v) => formatNumber(v) } = {}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return `<div class="col gap-3">${data.map((d) => `
    <div>
      <div class="row-between mb-2" style="gap:10px">
        <span class="fs-xs strong truncate">${escapeHtml(d.label)}</span>
        <span class="fs-xs text-3 tnum">${escapeHtml(String(d.meta !== undefined ? d.meta : format(d.value)))}</span>
      </div>
      <div class="progress" style="height:7px">
        <div class="progress__bar" style="width:${((d.value / max) * 100).toFixed(1)}%${d.color ? `;background:${d.color}` : ""}"></div>
      </div>
    </div>`).join("")}</div>`;
}

/** Inline sparkline. */
export function sparkline(values = [], { width = 108, height = 30, tone = "var(--accent)" } = {}) {
  if (values.length < 2) return "";
  const max = Math.max(...values, 1);
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => `${(stepX * i).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <polyline points="${points.join(" ")}" fill="none" stroke="${tone}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
  </svg>`;
}


