/* ==========================================================================
   Elevate — Ambient sound engine for Focus Mode
   Generates noise in the browser with the Web Audio API (no audio files).
   ========================================================================== */

let ctx = null;
let source = null;
let filter = null;
let gain = null;
let lfo = null;
let lfoGain = null;
let playing = false;
let currentKind = "brown";

const PROFILES = {
  brown: { type: "lowpass", frequency: 620, q: 0.6, gain: 0.5, lfo: 0 },
  rain: { type: "bandpass", frequency: 1600, q: 0.7, gain: 0.4, lfo: 0.12 },
  cafe: { type: "lowpass", frequency: 900, q: 1.1, gain: 0.45, lfo: 4.5 },
  forest: { type: "highpass", frequency: 420, q: 0.4, gain: 0.32, lfo: 0.08 }
};

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  return ctx;
}

/** Brown-ish noise buffer (2 seconds, looped) — warmer than white noise. */
function buildNoiseBuffer(audioContext) {
  const length = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function startAmbient(kind = "brown", volume = 0.4) {
  const audioContext = ensureContext();
  if (!audioContext) return false;
  stopAmbient();

  const profile = PROFILES[kind] || PROFILES.brown;
  currentKind = kind;

  source = audioContext.createBufferSource();
  source.buffer = buildNoiseBuffer(audioContext);
  source.loop = true;

  filter = audioContext.createBiquadFilter();
  filter.type = profile.type;
  filter.frequency.value = profile.frequency;
  filter.Q.value = profile.q;

  gain = audioContext.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(profile.gain * volume, audioContext.currentTime + 1.2);

  if (profile.lfo) {
    lfo = audioContext.createOscillator();
    lfo.frequency.value = profile.lfo;
    lfoGain = audioContext.createGain();
    lfoGain.gain.value = profile.gain * volume * 0.35;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
  }

  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start();
  if (audioContext.state === "suspended") audioContext.resume();
  playing = true;
  return true;
}

export function stopAmbient() {
  if (!ctx) { playing = false; return; }
  try {
    if (gain) gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
    const stopping = source;
    const stoppingLfo = lfo;
    setTimeout(() => {
      try { stopping?.stop(); } catch { /* already stopped */ }
      try { stoppingLfo?.stop(); } catch { /* already stopped */ }
    }, 420);
  } catch {
    /* ignore */
  }
  source = null;
  filter = null;
  gain = null;
  lfo = null;
  lfoGain = null;
  playing = false;
}

export function setAmbientVolume(volume) {
  if (!gain || !ctx) return;
  const profile = PROFILES[currentKind] || PROFILES.brown;
  gain.gain.linearRampToValueAtTime(profile.gain * Math.max(0, Math.min(1, volume)), ctx.currentTime + 0.2);
}

export const isAmbientPlaying = () => playing;
export const currentSound = () => currentKind;

/** Short completion chime for timers and checkboxes. */
export function chime({ type = "complete" } = {}) {
  const audioContext = ensureContext();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const notes = type === "complete" ? [523.25, 659.25, 783.99] : [440, 349.23];
  notes.forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    const env = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.0001, now + index * 0.12);
    env.gain.exponentialRampToValueAtTime(0.16, now + index * 0.12 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.5);
    osc.connect(env).connect(audioContext.destination);
    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 0.55);
  });
}

export const unlockAudio = () => {
  const audioContext = ensureContext();
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
};
