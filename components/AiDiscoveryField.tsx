import React, { useEffect, useRef, useState } from 'react';

type Point = readonly [number, number];
/** A shape is a set of filled regions and thick strokes, rasterised onto a grid. */
type Mark = { poly: Point[]; path?: never; width?: never }
  | { path: Point[]; width: number; poly?: never };

const VIEW = 240;
/** Grid the illustrations are drawn on, which is also where the dots come to rest. */
// A fine grid with small dots: edges and curves read smoothly instead of as blocks.
const PITCH = 4.5;
const COLUMNS = 51;
const ORIGIN = (VIEW - (COLUMNS - 1) * PITCH) / 2;

const arc = (cx: number, cy: number, radius: number, from: number, to: number, steps = 24): Point[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + (to - from) * index / steps;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as Point;
  });

/** Lozenge standing up: straight sides between two half-circle ends. */
const capsule = (cx: number, top: number, bottom: number, radius: number): Point[] => [
  ...arc(cx, top, radius, Math.PI, 2 * Math.PI),
  ...arc(cx, bottom, radius, 0, Math.PI),
];

/** The same lozenge lying down. */
const lozenge = (x1: number, x2: number, y: number, half: number): Point[] => [
  ...arc(x1 + half, y, half, Math.PI / 2, 1.5 * Math.PI),
  ...arc(x2 - half, y, half, -Math.PI / 2, Math.PI / 2),
];

const inPolygon = (poly: readonly Point[], x: number, y: number) => {
  let inside = false;
  for (let index = 0, prev = poly.length - 1; index < poly.length; prev = index++) {
    const [xi, yi] = poly[index];
    const [xj, yj] = poly[prev];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const alongPath = (path: readonly Point[], closed: boolean, x: number, y: number) => {
  let best = Infinity;
  const last = closed ? path.length : path.length - 1;
  for (let index = 0; index < last; index++) {
    const [ax, ay] = path[index];
    const [bx, by] = path[(index + 1) % path.length];
    const dx = bx - ax;
    const dy = by - ay;
    const span = dx * dx + dy * dy;
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / span));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
};

/** Zero inside the illustration, growing with distance outside it. */
const clearance = (marks: readonly Mark[], x: number, y: number) => {
  let best = Infinity;
  for (const mark of marks) {
    if (mark.poly) {
      if (inPolygon(mark.poly, x, y)) return 0;
      best = Math.min(best, alongPath(mark.poly, true, x, y));
    } else {
      best = Math.min(best, Math.max(0, alongPath(mark.path, false, x, y) - mark.width / 2));
    }
  }
  return best;
};

/** Round to a grid line, so a row of bars lights an even number of cells. */
const snap = (value: number) => ORIGIN + Math.round((value - ORIGIN) / PITCH) * PITCH;

// ---------------------------------------------------------------- shapes ----

const MIC_CX = 120;
const micWave = (radius: number, spread: number, side: 1 | -1) =>
  arc(MIC_CX, 112, radius, (side === 1 ? 0 : Math.PI) - spread, (side === 1 ? 0 : Math.PI) + spread);

const microphone: Mark[] = [
  { poly: capsule(MIC_CX, 68, 110, 22) },
  { path: [[80, 104], [80, 118], ...arc(MIC_CX, 118, 40, Math.PI, 0), [160, 104]], width: 9 },
  { path: [[MIC_CX, 158], [MIC_CX, 188]], width: 9 },
  { path: [[100, 192], [140, 192]], width: 9 },
  { path: micWave(62, 0.5, -1), width: 8 },
  { path: micWave(84, 0.62, -1), width: 8 },
  { path: micWave(62, 0.5, 1), width: 8 },
  { path: micWave(84, 0.62, 1), width: 8 },
];

/** Bars sit half a cell off the grid lines, so each is four dots wide; the
    capsule ends step in to two dots, which is what reads as a rounded cap. */
const WAVE_HEIGHTS = [46, 96, 136, 150, 116, 144, 88, 52];
const WAVE_SPACING = PITCH * 6;
const WAVE_FIRST = MIC_CX + PITCH / 2 - (WAVE_HEIGHTS.length - 1) / 2 * WAVE_SPACING;
const WAVE_AXIS = 120;

const WAVE_CAP = 8;

const waveform: Mark[] = WAVE_HEIGHTS.map((height, index) => {
  const x = WAVE_FIRST + index * WAVE_SPACING;
  return { poly: capsule(x, snap(WAVE_AXIS - height / 2 + WAVE_CAP), snap(WAVE_AXIS + height / 2 - WAVE_CAP), WAVE_CAP) };
});

const barAt = (x: number) => Math.round((x - WAVE_FIRST) / WAVE_SPACING);

const BAR = 8;
const rowBar = (x1: number, x2: number, y: number): Mark => ({ poly: lozenge(x1, x2, y, BAR) });

/** Rows sit three grid steps either side of their line, leaving a clear gap between the two bars. */
const ROW_GAP = PITCH * 3;
const ROWS = [snap(62), 120, snap(178)];

const transcript: Mark[] = [
  rowBar(24, 80, ROWS[0] - ROW_GAP), rowBar(94, 216, ROWS[0] + ROW_GAP),
  rowBar(24, 138, ROWS[1] - ROW_GAP), rowBar(152, 216, ROWS[1] + ROW_GAP),
  rowBar(24, 96, ROWS[2] - ROW_GAP), rowBar(110, 216, ROWS[2] + ROW_GAP),
];

const tasks: Mark[] = ROWS.flatMap(y => [
  { path: [[30, y], [43, y + 13], [64, y - 14]], width: 10 } as Mark,
  rowBar(86, 212, y - ROW_GAP),
  rowBar(86, 172, y + ROW_GAP),
]);

/** Four-pointed sparkle: the mark for a highlight rather than a task. */
const sparkle = (cx: number, cy: number, reach: number, waist: number): Point[] =>
  Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4 - Math.PI / 2;
    const radius = index % 2 === 0 ? reach : waist;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as Point;
  });

const highlights: Mark[] = [
  { poly: sparkle(50, ROWS[0], 30, 11) },
  rowBar(88, 212, ROWS[0] - ROW_GAP), rowBar(88, 176, ROWS[0] + ROW_GAP),
  { poly: lozenge(34, 66, ROWS[1], 9) },
  rowBar(88, 212, ROWS[1] - ROW_GAP), rowBar(88, 194, ROWS[1] + ROW_GAP),
  { poly: lozenge(34, 66, ROWS[2], 9) },
  rowBar(88, 212, ROWS[2] - ROW_GAP), rowBar(88, 168, ROWS[2] + ROW_GAP),
];

// ------------------------------------------------------ resting positions ----

const GRID: Point[] = Array.from({ length: COLUMNS * COLUMNS }, (_, index) => [
  ORIGIN + (index % COLUMNS) * PITCH,
  ORIGIN + Math.floor(index / COLUMNS) * PITCH,
]);

/** Cells the illustration covers, in reading order so the sweep stays coherent. */
const seatsFor = (marks: readonly Mark[]) =>
  GRID.filter(cell => clearance(marks, cell[0], cell[1]) === 0);

const SEATS = {
  mic: seatsFor(microphone),
  wave: seatsFor(waveform),
  text: seatsFor(transcript),
  tasks: seatsFor(tasks),
  highlights: seatsFor(highlights),
};

/** One dot per seat of the fullest illustration; leaner ones double a few up. */
const DOTS = Math.max(...Object.values(SEATS).map(seats => seats.length));

const spread = (seats: Point[]): Point[] =>
  Array.from({ length: DOTS }, (_, index) =>
    seats[Math.min(seats.length - 1, Math.floor(index * seats.length / DOTS))]);

const PLACES = {
  mic: spread(SEATS.mic),
  wave: spread(SEATS.wave),
  text: spread(SEATS.text),
  tasks: spread(SEATS.tasks),
  highlights: spread(SEATS.highlights),
};

// ------------------------------------------------------------------ halo ----

/**
 * The card is a haze of paler dots gathered around the illustration. It has no
 * edge of its own: the smoothstep takes the brightness to zero with a flat
 * tail, so the dots dissolve into the page instead of ending on a line.
 */
const HALO_PITCH = 7;
const HALO_COLUMNS = 33;
const HALO_ORIGIN = (VIEW - (HALO_COLUMNS - 1) * HALO_PITCH) / 2;
const HALO_REACH = 52;
const HALO_LEVEL = 0.17;

const HALO: Point[] = Array.from({ length: HALO_COLUMNS * HALO_COLUMNS }, (_, index) => [
  HALO_ORIGIN + (index % HALO_COLUMNS) * HALO_PITCH,
  HALO_ORIGIN + Math.floor(index / HALO_COLUMNS) * HALO_PITCH,
]);

const haze = (marks: readonly Mark[], point: Point) => {
  const t = Math.max(0, 1 - clearance(marks, point[0], point[1]) / HALO_REACH);
  return Math.round(t * t * (3 - 2 * t) * HALO_LEVEL * 100) / 100;
};

// ------------------------------------------------------------- animation ----

const PHASES = ['mic', 'wave', 'text', 'result'] as const;
type Phase = typeof PHASES[number];

/** Each dot leaves a little after the one before it, so the shape is rebuilt. */
const STAGGER_MS = 780;
const MIN_TRAVEL_MS = 340;
const MAX_TRAVEL_MS = 760;
const MS_PER_UNIT = 2.4;
const HOLD_MS = 1250;
const SETTLE_MS = STAGGER_MS + MAX_TRAVEL_MS;
/** The waveform lingers: its level meter is the part worth watching. */
const PHASE_MS: Record<Phase, number> = {
  mic: SETTLE_MS + HOLD_MS,
  wave: SETTLE_MS + 3200,
  text: SETTLE_MS + HOLD_MS,
  result: SETTLE_MS + 1700,
};

const travel = (from: Point, to: Point) =>
  Math.round(Math.min(MAX_TRAVEL_MS, MIN_TRAVEL_MS + Math.hypot(to[0] - from[0], to[1] - from[1]) * MS_PER_UNIT));

/** Deterministic, so the sweep reads as separate dots rather than a moving bar. */
const jitter = (index: number, range: number) =>
  (Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1) * range;

const timingFor = (result: Point[]) => PLACES.mic.map((_, index) => ({
  delay: Math.round(index / (DOTS - 1) * STAGGER_MS + jitter(index, 90) - 45),
  wave: travel(PLACES.mic[index], PLACES.wave[index]),
  text: travel(PLACES.wave[index], PLACES.text[index]),
  result: travel(PLACES.text[index], result[index]),
  mic: travel(result[index], PLACES.mic[index]),
  breath: -Math.round(jitter(index + 7, 2600)),
  // Live level: dots further from the axis swing further, so the bar itself
  // lengthens and shortens instead of the whole column sliding up and down.
  lift: Math.round((PLACES.wave[index][1] - WAVE_AXIS) * 0.3 * 10) / 10,
  beat: -(barAt(PLACES.wave[index][0]) * 139 + 90),
  tempo: 620 + (barAt(PLACES.wave[index][0]) % 4) * 130,
}));
const TIMING = { tasks: timingFor(PLACES.tasks), highlights: timingFor(PLACES.highlights) };

// --------------------------------------------------------------- drawing ----
//
// Drawn on a canvas: one paint per frame for every dot, instead of hundreds of
// SVG nodes each running CSS transitions and animations (which the browser
// repaints one by one and which made the motion stutter).

/** cubic-bezier(.32,.04,.22,1): leaves gently, settles softly. */
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const d = slope(x1, x2, t); if (Math.abs(d) < 1e-6) break; t -= (at(x1, x2, t) - x) / d; }
    return at(y1, y2, Math.min(1, Math.max(0, t)));
  };
};
const travelEase = bezier(0.32, 0.04, 0.22, 1);
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeOut = (t: number) => 1 - (1 - t) ** 2;

type Motion = { fromX: number; fromY: number; toX: number; toY: number; start: number; duration: number };
const placeFor = (phase: Phase, mode: 'tasks' | 'highlights', index: number): Point =>
  phase === 'result' ? PLACES[mode][index] : PLACES[phase][index];
const durationFor = (phase: Phase, mode: 'tasks' | 'highlights', index: number) => TIMING[mode][index][phase];
const MOTES = {
  mic: HALO.map(point => haze(microphone, point)),
  wave: HALO.map(point => haze(waveform, point)),
  text: HALO.map(point => haze(transcript, point)),
  tasks: HALO.map(point => haze(tasks, point)),
  highlights: HALO.map(point => haze(highlights, point)),
};
const moteTarget = (phase: Phase, mode: 'tasks' | 'highlights') => phase === 'result' ? MOTES[mode] : MOTES[phase];
const MOTE_DELAY = HALO.map((_, index) => Math.round(jitter(index, 520)));

/** Illustrative loop: microphone → waveform → transcript → extracted results. */
export const AiDiscoveryField: React.FC<{
  mode: 'tasks' | 'highlights';
  background?: boolean;
  /** Kept mounted but faded out, so the loop does not restart on every scan. */
  visible?: boolean;
  /** Holds the current illustration while the meeting is neither live nor scanning. */
  running?: boolean;
}> = React.memo(({ mode, background = false, visible = true, running = true }) => {
  const [phase, setPhase] = useState<Phase>('mic');
  // The chain drives itself from a ref: putting it in the state updater would
  // schedule two timers under StrictMode's double invocation.
  const standing = useRef<Phase>('mic');
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ phase: 'mic' as Phase, mode, running, visible, wake: () => {} });

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    const tick = () => {
      standing.current = PHASES[(PHASES.indexOf(standing.current) + 1) % PHASES.length];
      setPhase(standing.current);
      timer = window.setTimeout(tick, PHASE_MS[standing.current]);
    };
    const start = () => {
      window.clearTimeout(timer);
      if (calm.matches || !running) return;
      timer = window.setTimeout(tick, PHASE_MS[standing.current]);
    };
    start();
    calm.addEventListener('change', start);
    return () => {
      window.clearTimeout(timer);
      calm.removeEventListener('change', start);
    };
  }, [running]);

  // Renderer: owns its own clock and per-dot journeys; React only tells it the phase.
  useEffect(() => {
    const el = canvas.current, box = field.current;
    if (!el || !box) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const now = () => performance.now();
    const state = live.current;
    const moves: Motion[] = PLACES.mic.map(([x, y]) => ({ fromX: x, fromY: y, toX: x, toY: y, start: 0, duration: 0 }));
    const motes = moteTarget(state.phase, state.mode).map(value => ({ from: value, to: value, start: 0 }));
    let shownPhase = state.phase, shownMode = state.mode, phaseAt = now(), levelFrom = 0, levelTo = 0, levelAt = 0;
    let frame = 0, onScreen = true, size = 0, ratio = 1;

    const position = (move: Motion, t: number): Point => {
      if (t <= move.start) return [move.fromX, move.fromY];
      const k = travelEase(Math.min(1, (t - move.start) / Math.max(1, move.duration)));
      return [move.fromX + (move.toX - move.fromX) * k, move.fromY + (move.toY - move.fromY) * k];
    };
    const retarget = () => {
      const t = now(), instant = calm.matches;
      moves.forEach((move, index) => {
        const [x, y] = position(move, t);
        const [toX, toY] = placeFor(state.phase, state.mode, index);
        Object.assign(move, { fromX: instant ? toX : x, fromY: instant ? toY : y, toX, toY, start: t + Math.max(0, TIMING[state.mode][index].delay), duration: instant ? 0 : durationFor(state.phase, state.mode, index) });
      });
      const target = moteTarget(state.phase, state.mode);
      motes.forEach((mote, index) => {
        const k = Math.min(1, Math.max(0, (t - mote.start) / 500));
        mote.from = instant ? target[index] : mote.from + (mote.to - mote.from) * easeOut(k);
        mote.to = target[index];
        mote.start = t + MOTE_DELAY[index];
      });
      const level = state.phase === 'wave' && state.running ? 1 : 0;
      levelFrom = levelNow(t); levelTo = level; levelAt = t;
      shownPhase = state.phase; shownMode = state.mode; phaseAt = t;
    };
    // The sound-level wobble eases in and out instead of snapping on and off.
    const levelNow = (t: number) => levelFrom + (levelTo - levelFrom) * easeInOut(Math.min(1, (t - levelAt) / 450));
    const resize = () => {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      size = el.clientWidth;
      el.width = Math.round(size * ratio); el.height = Math.round(size * ratio);
    };
    const draw = () => {
      const t = now();
      if (shownPhase !== state.phase || shownMode !== state.mode) retarget();
      const still = calm.matches;
      const ink = getComputedStyle(box).getPropertyValue('--discovery-ink').trim() || '#55585f';
      const scale = size / VIEW;
      // Idle breathing of the whole illustration, as before (1 → 1.022 over 7s).
      const float = still || !state.running ? 1 : 1 + 0.011 * (1 - Math.cos((t / 7000) * Math.PI * 2));
      ctx.setTransform(ratio * scale * float, 0, 0, ratio * scale * float, ratio * scale * VIEW / 2 * (1 - float), ratio * scale * VIEW / 2 * (1 - float));
      ctx.clearRect(-20, -20, VIEW + 40, VIEW + 40);
      ctx.fillStyle = ink;
      motes.forEach((mote, index) => {
        const k = Math.min(1, Math.max(0, (t - mote.start) / 500));
        const alpha = mote.from + (mote.to - mote.from) * easeOut(k);
        if (alpha < 0.005) return;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(HALO[index][0], HALO[index][1], 1, 0, Math.PI * 2); ctx.fill();
      });
      const level = still ? 0 : levelNow(t);
      const timing = TIMING[state.mode];
      moves.forEach((move, index) => {
        const [x, y] = position(move, t);
        const dot = timing[index];
        let lift = 0;
        if (level > 0) {
          const cycle = (((t - dot.beat) % dot.tempo) + dot.tempo) % dot.tempo / dot.tempo;
          const swing = easeInOut(cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2);
          lift = (-0.5 + 1.15 * swing) * dot.lift * level;
        }
        const breath = still ? 0.92 : 0.78 + 0.22 * (0.5 - 0.5 * Math.cos(((t - dot.breath) / 2600) * Math.PI * 2));
        ctx.globalAlpha = breath;
        ctx.beginPath(); ctx.arc(x, y + lift, 1.3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    const settled = () => {
      const t = now();
      return moves.every(move => t >= move.start + move.duration) && t - phaseAt > 1200 && levelNow(t) === levelTo;
    };
    // Keep painting while anything moves; a paused, settled field is drawn once and left alone.
    const loop = () => {
      draw();
      frame = 0;
      if (onScreen && state.visible && (state.running || !settled()) && !calm.matches) frame = requestAnimationFrame(loop);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };
    state.wake = wake;
    const sizes = new ResizeObserver(() => { resize(); wake(); });
    const seen = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) wake(); });
    resize(); retarget(); sizes.observe(el); seen.observe(box); wake();
    calm.addEventListener('change', wake);
    return () => { cancelAnimationFrame(frame); sizes.disconnect(); seen.disconnect(); calm.removeEventListener('change', wake); state.wake = () => {}; };
  }, []);

  useEffect(() => {
    Object.assign(live.current, { phase, mode, running, visible });
    live.current.wake();
  }, [phase, mode, running, visible]);

  return (
    <div ref={field} className={`ai-discovery-field ${background ? 'ai-discovery-background' : ''}`}
      data-visible={visible} data-moving={running} aria-hidden="true">
      <canvas ref={canvas} className="ai-discovery-morph" data-phase={phase} />
    </div>
  );
});
