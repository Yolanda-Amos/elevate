/* ==========================================================================
   Elevate — Cursor glow
   A short, soft trail that follows a fine pointer. Hand-rolled on one canvas
   so there are no images and no libraries, same as the charts and audio.

   Deliberate constraints:
   • the rAF loop only exists while the pointer is moving — it stops itself
     once the tail has dissolved, so an idle tab costs nothing
   • never runs for touch input, or when the OS asks for reduced motion
   • colour is read from --accent, so it re-tints with theme and accent
   • the canvas is pointer-events:none at z-index --z-cursor, under every
     overlay, so it can't swallow a click or tint a dialog
   ========================================================================== */

const TAIL = 26;        /* points retained in the tail */
const FOLLOW = 0.26;    /* easing toward the live pointer */
const DECAY = 0.9;      /* per-frame fade of each point */
const FALLBACK = "#5b5bd6";

const prefersReduced = () =>
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const isTouchPrimary = () =>
  Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/* Tokens are hex, but tolerate a stray rgb()/rgba() rather than guessing. */
function toRgb(color) {
  const value = String(color || "").trim();
  const hex = /^#?([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const short = /^#?([0-9a-f]{3})$/i.exec(value);
  if (short) {
    const [r, g, b] = short[1].split("").map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length >= 3) return parts.slice(0, 3);
  }
  return [91, 91, 214];
}

export function createCursorTrail() {
  const canvas = document.createElement("canvas");
  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;

  /* Headless (tests) or a canvas-less environment: hand back a harmless API
     rather than throwing during boot. */
  if (!ctx || !window.requestAnimationFrame) {
    return { setEnabled() {}, destroy() {}, get enabled() { return false; } };
  }

  let rgb = toRgb(FALLBACK);
  let points = [];
  let tx = -100, ty = -100, hx = -100, hy = -100;
  let raf = 0;
  let on = false;
  let boost = 0;

  canvas.className = "cursor-trail";
  canvas.setAttribute("aria-hidden", "true");

  const readAccent = () => {
    const styles = window.getComputedStyle?.(document.documentElement);
    rgb = toRgb(styles?.getPropertyValue?.("--accent") || FALLBACK);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const stop = () => {
    if (raf) { window.cancelAnimationFrame?.(raf); raf = 0; }
    canvas.classList.remove("is-on");
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    points = [];
  };

  const paint = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const dark = document.documentElement.dataset?.theme === "dark";
    /* Additive in dark mode so it reads as light; plain alpha in light mode
       so it never washes the page out. */
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const p = points[i];
      p.a *= DECAY;
      if (p.a < 0.012) { points.splice(i, 1); continue; }
      const r = p.r * (0.35 + p.a * 0.85);
      const [cr, cg, cb] = rgb;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${(p.a * 0.5).toFixed(3)})`);
      glow.addColorStop(0.45, `rgba(${cr}, ${cg}, ${cb}, ${(p.a * 0.16).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  const frame = () => {
    raf = window.requestAnimationFrame(frame);
    hx += (tx - hx) * FOLLOW;
    hy += (ty - hy) * FOLLOW;
    const speed = Math.hypot(tx - hx, ty - hy);
    if (speed <= 0.4 && !points.length) { stop(); return; }
    if (speed > 0.4) {
      points.unshift({
        x: hx,
        y: hy,
        a: 0.5 + Math.min(speed / 70, 0.4) + boost * 0.25,
        r: 9 + Math.min(speed * 0.2, 15) + boost * 6
      });
      if (points.length > TAIL) points.length = TAIL;
    }
    boost *= 0.9;
    canvas.classList.add("is-on");
    paint();
  };

  const move = (event) => {
    if (!on || event.pointerType === "touch") return;
    if (tx < 0) { hx = event.clientX; hy = event.clientY; }
    tx = event.clientX;
    ty = event.clientY;
    if (!raf) raf = window.requestAnimationFrame(frame);
  };

  /* The glow swells over anything clickable — quiet hover feedback. */
  const over = (event) => {
    if (on && event.target?.closest?.('a, button, [role="button"], input, select, textarea, .card--interactive')) boost = 1;
  };

  const down = () => { if (on) boost = 1; };
  const reflow = () => { if (on) resize(); };

  function setEnabled(next) {
    const want = Boolean(next) && !prefersReduced() && !isTouchPrimary();
    if (want === on) return;
    on = want;
    if (!on) { stop(); return; }
    readAccent();
    resize();
  }

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerover", over, { passive: true });
  window.addEventListener("pointerdown", down, { passive: true });
  window.addEventListener("resize", reflow, { passive: true });

  /* Settings → Appearance repaints the accent/theme on <html>; follow it. */
  const observer = new MutationObserver(readAccent);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent", "data-theme"] });

  readAccent();

  return {
    setEnabled,
    destroy() {
      stop();
      on = false;
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("resize", reflow);
      canvas.remove();
    },
    get enabled() { return on; }
  };
}

