import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { siAsana, siGooglecalendar, siGooglemeet, siJira, siNotion, siTelegram, siTrello, siZoom } from 'simple-icons';
import { ArrowUpRight, ArrowRight, Check, CheckCircle2, Clock, MessageSquare, PhoneOff, Sparkles, Mic, Play, Pause, RotateCcw, Sun, Moon, Layers3, CheckCheck, ChevronDown, Users } from 'lucide-react';
import { AiDiscoveryField } from '../components/AiDiscoveryField';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/newsreader/opsz.css';
import { useTheme } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { LANGUAGES, getCatalogue } from '../i18n';
import { getPublicCopy } from '../i18n/public';
import type { Language } from '../types';
import './landing.css';
import { Select } from '../components/ui/Select';

const ICON = { strokeWidth: 1.5 };
// Placeholder photography (picsum ids chosen for desk/notes/phone scenes). Swap for real product photos.
const PHOTOS = { notes: 'https://picsum.photos/id/180/1200/800?grayscale', desk: 'https://picsum.photos/id/1/900/600?grayscale' };

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ type: 'spring', stiffness: 100, damping: 20, delay }}>{children}</motion.div>;
}

type Step = 0 | 1 | 2;
type Layer = { title: string; text: string };

// Scene space mirrors the reference: a fixed 1400 x 1219 canvas scaled to the column, orthographic 3D via CSS.
const SCENE = { w: 1400, h: 1219, push: -400, tiltX: 27.5, tiltY: -20.6 };
const BOX = {
  team: { x: 0, y: 80, w: 1272, h: 214 }, ai: { x: 0, y: 314, w: 804, h: 214 }, memory: { x: 0, y: 548, w: 804, h: 214 },
  glyph: { x: 824, y: 314, w: 448, h: 448 }, meetings: { x: 0, y: 925, w: 1272, h: 214 },
};
const CELL = { y: 782, size: 123, step: 143.6 };
// Planned integrations (not live yet); the copy beside the scene says so.
const INTEGRATIONS = [siGooglemeet, siZoom, siTelegram, siGooglecalendar, siNotion, siJira, siTrello, siAsana];
const easeInOut = (p: number) => p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
const seg = (t: number, start: number, duration: number) => easeInOut(Math.min(1, Math.max(0, (t - start) / duration)));

function SceneFrame({ box, t, rise, y, className = '', children }: { box: { x: number; y: number; w: number; h: number }; t: MotionValue<number>; rise?: [number, number]; y?: MotionValue<number>; className?: string; children?: React.ReactNode }) {
  const z = useTransform(t, v => rise ? SCENE.push * (1 - seg(v, rise[0], rise[1])) : 0);
  // Layers rise from behind the backdrop: invisible until they cross roughly z = -150.
  const opacity = useTransform(z, v => Math.min(1, Math.max(0, (v + 400) / 250)));
  return <motion.div className={`lp-sf ${className}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h, z, y }}>
    <motion.div className="lp-sf-face" style={{ opacity }}>{children}</motion.div>
    {['tr', 'br', 'bl'].map(edge => <motion.i key={edge} className={`lp-sf-edge lp-sf-edge-${edge}`} style={{ opacity }} aria-hidden="true" />)}
  </motion.div>;
}

function LayerText({ layer }: { layer: Layer }) {
  return <><strong>{layer.title}</strong><span>{layer.text}</span></>;
}

function IntegrationMark({ icon }: { icon: (typeof INTEGRATIONS)[number] }) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={icon.title}><path d={icon.path} fill="currentColor" /></svg>;
}

/**
 * Team / MeetTask AI + memory + logo / integrations / meetings, scrubbed by scroll in three phases:
 * tilt while the AI layers and logo rise, drop the meetings layer while integrations rise, then settle flat.
 */
function StackScene({ layers, more, progress }: { layers: Layer[]; more: string; progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.42);
  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SCENE.w));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const t = useTransform(progress, p => reduce ? 2.7 : p * 2.7);
  const tilt = useTransform(t, v => seg(v, 0, 0.4) - seg(v, 2, 0.7));
  const rotateX = useTransform(tilt, v => v * SCENE.tiltX);
  const rotateY = useTransform(tilt, v => v * SCENE.tiltY);
  // Meetings sit right under the team at first, drop below the AI layers, then make room for integrations.
  const meetingsY = useTransform(t, v => -611 + 468 * seg(v, 0, 0.4) + 143 * seg(v, 1, 0.4));
  const centerY = useTransform(meetingsY, v => -v / 2);
  const [team, ai, memory, meetings] = layers;
  return <div ref={wrap} className="lp-scene" style={{ height: SCENE.h * scale }} role="img" aria-label={layers.map(layer => layer.title).join(', ')}>
    <div className="lp-scene-scale" style={{ width: SCENE.w, height: SCENE.h, transform: `scale(${scale})` }}>
      <motion.div className="lp-scene-root" style={{ rotateX, rotateY, y: centerY }}>
        <SceneFrame box={BOX.team} t={t}><LayerText layer={team} /></SceneFrame>
        <SceneFrame box={BOX.ai} t={t} rise={[0.4, 0.5]} className="is-ai"><LayerText layer={ai} /></SceneFrame>
        <SceneFrame box={BOX.memory} t={t} rise={[0.47, 0.5]}><LayerText layer={memory} /></SceneFrame>
        <SceneFrame box={BOX.glyph} t={t} rise={[0.54, 0.5]} className="is-glyph"><span className="lp-sf-logo" /></SceneFrame>
        {[...INTEGRATIONS, null].map((icon, i) => <SceneFrame key={icon?.slug ?? 'more'} box={{ x: i * CELL.step, y: CELL.y, w: CELL.size, h: CELL.size }} t={t} rise={[1.4 + 0.04 * i, 0.4]} className="is-cell">
          {icon ? <IntegrationMark icon={icon} /> : <span className="lp-sf-more">{more}</span>}
        </SceneFrame>)}
        <SceneFrame box={BOX.meetings} t={t} y={meetingsY}><LayerText layer={meetings} /></SceneFrame>
      </motion.div>
    </div>
  </div>;
}

/** Small screens get the finished stack as plain, flat layout. */
function FlatStack({ layers, more }: { layers: Layer[]; more: string }) {
  const [team, ai, memory, meetings] = layers;
  return <div className="lp-flat" role="list">
    <div className="lp-flat-frame" role="listitem"><LayerText layer={team} /></div>
    <div className="lp-flat-core">
      <div className="lp-flat-frame" role="listitem"><LayerText layer={ai} /></div>
      <div className="lp-flat-frame" role="listitem"><LayerText layer={memory} /></div>
      <div className="lp-flat-frame lp-flat-glyph" aria-hidden="true"><span className="lp-sf-logo" /></div>
    </div>
    <div className="lp-flat-cells">{[...INTEGRATIONS, null].map(icon => <div key={icon?.slug ?? 'more'} className="lp-flat-frame">
      {icon ? <IntegrationMark icon={icon} /> : <span className="lp-sf-more">{more}</span>}
    </div>)}</div>
    <div className="lp-flat-frame" role="listitem"><LayerText layer={meetings} /></div>
  </div>;
}

/** Three sticky statements on the left; scrolling through them scrubs the stack scene on the right. */
function LayersSection({ c }: { c: ReturnType<typeof getPublicCopy> }) {
  const ref = useRef<HTMLElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [step, setStep] = useState<Step>(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.0005 });
  // The active statement is the pinned card closest to the middle of the viewport.
  useMotionValueEvent(scrollYProgress, 'change', () => {
    const frames = ref.current?.querySelectorAll('.lp-frame');
    if (!frames) return;
    let next = 0, best = Infinity;
    frames.forEach((frame, i) => {
      const box = frame.getBoundingClientRect();
      const distance = Math.abs(box.top + box.height / 2 - window.innerHeight / 2);
      if (distance < best) { best = distance; next = i; }
    });
    setStep(current => current === next ? current : next as Step);
  });
  const cards = [[c.visionLabel, c.visionTitle, c.visionText], [c.modelLabel, c.modelTitle, c.modelText], [c.resultLabel, c.resultTitle, c.resultText]] as const;
  return <section ref={ref} className="lp-section lp-layers">
    <div className="lp-layers-copy">{cards.map(([label, title, text], i) => <div key={label} className="lp-frame-track">
      <div className={`lp-frame ${desktop ? (step === i ? 'is-active' : '') : i === 1 ? 'is-active' : ''}`}><p className="lp-eyebrow">{label}</p><h2>{title[0]}<br />{title[1]}</h2><p className="lp-frame-text">{text}</p></div>
    </div>)}</div>
    <div className="lp-layers-visual">{desktop ? <StackScene layers={c.layers} more={c.integrationsMore} progress={progress} /> : <FlatStack layers={c.layers} more={c.integrationsMore} />}</div>
  </section>;
}

/** Monochrome MeetTask logo (mark + wordmark) drawn as masks so it takes the theme ink. */
export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  return <span className={`lp-logo ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true"><i className="lp-logo-mark" /><i className="lp-logo-word" /></span>;
}


/** Page progress traced clockwise around the logo pill, starting top-centre, with a glowing head dot. */
function ProgressRing({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll();
  const [size, setSize] = useState({ w: 0, h: 0, r: 0 });
  const path = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const dot = useRef<SVGGElement>(null);
  useEffect(() => {
    const node = target.current;
    if (!node) return;
    const read = () => {
      const w = node.offsetWidth, h = node.offsetHeight, r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      setSize(current => current.w === w && current.h === h && current.r === r ? current : { w, h, r });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);
  const paint = (progress: number) => {
    const line = path.current;
    if (!line) return;
    const offset = String(1 - progress);
    line.style.strokeDashoffset = offset;
    if (glow.current) glow.current.style.strokeDashoffset = offset;
    const point = line.getPointAtLength(progress * line.getTotalLength());
    dot.current?.setAttribute('transform', `translate(${point.x} ${point.y})`);
    dot.current?.setAttribute('opacity', progress > 0.002 ? '1' : '0');
  };
  useMotionValueEvent(scrollYProgress, 'change', paint);
  useEffect(() => paint(scrollYProgress.get()), [size]); // eslint-disable-line react-hooks/exhaustive-deps
  const { w, h } = size;
  if (!w || !h) return null;
  // Trace the pill's real outline, whatever radius the CSS gives it.
  const r = Math.min(size.r, h / 2, w / 2);
  const d = `M ${w / 2} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 L ${w / 2} 0`;
  return <svg className="lp-ring" width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible" aria-hidden="true">
    <defs><filter id="lp-ring-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter></defs>
    <path d={d} className="lp-ring-track" />
    <path ref={glow} d={d} className="lp-ring-line" pathLength={1} strokeDasharray={1} filter="url(#lp-ring-glow)" />
    <path ref={path} d={d} className="lp-ring-line" pathLength={1} strokeDasharray={1} />
    <g ref={dot} opacity={0}><circle r={5} className="lp-ring-dot" filter="url(#lp-ring-glow)" /><circle r={2.5} className="lp-ring-dot" /></g>
  </svg>;
}

/** Eased return to the top that stops the moment the reader scrolls, taps or presses a key. */
function scrollToTop(instant: boolean) {
  const from = window.scrollY;
  if (from <= 0) return;
  if (instant) { window.scrollTo(0, 0); return; }
  const started = performance.now();
  let cancelled = false;
  const cancel = () => { cancelled = true; cleanup(); };
  const cleanup = () => { window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel); window.removeEventListener('keydown', cancel); };
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', cancel);
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - started) / 1100);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    window.scrollTo(0, from * (1 - eased));
    if (t < 1) requestAnimationFrame(step); else cleanup();
  };
  requestAnimationFrame(step);
}

type NavProps = { c: ReturnType<typeof getPublicCopy>; language: Language; onLanguageChange: (language: Language) => void; signedIn: boolean; onStart: () => void; go: (id: string) => void };

/** Floating glass pills, after antimetal.com: links left, logo centre (collapses on scroll), actions right. */
function Nav({ c, language, onLanguageChange, signedIn, onStart, go }: NavProps) {
  const { theme, toggleTheme } = useTheme();
  const { scrollY } = useScroll();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const reduce = useReducedMotion();
  const logo = useRef<HTMLAnchorElement>(null);
  // Condense past 220px (re-expand under 110px), and open up again near the end of the page.
  useMotionValueEvent(scrollY, 'change', value => {
    const nearEnd = document.documentElement.scrollHeight - window.innerHeight - value < 160;
    setCollapsed(current => !nearEnd && (current ? value > 110 : value > 220));
  });
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const links: Array<[string, string]> = [['demo', c.nav[1]], ['features', c.nav[0]], ['pricing', c.nav[2]]];
  const visit = (id: string) => { setMenu(false); go(id); };
  return <nav className="lp-nav" aria-label={c.navAria}>
    <ul className="lp-glass lp-nav-links" onMouseLeave={() => setHovered(null)}>
      {links.map(([id, label], i) => <li key={id} onMouseEnter={() => setHovered(i)}>
        {hovered === i && <motion.span layoutId="lp-nav-hover" className="lp-nav-hover" transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }} />}
        <button onClick={() => visit(id)}>{label}</button>
      </li>)}
    </ul>
    <a ref={logo} className={`lp-glass lp-nav-logo ${collapsed ? 'is-collapsed' : ''}`} href="#/landing" aria-label={collapsed ? c.toTop : c.home} onClick={event => { event.preventDefault(); scrollToTop(Boolean(reduce)); }}>
      <ProgressRing target={logo} /><Wordmark collapsed={collapsed} />
    </a>
    <div className="lp-glass lp-nav-actions">
      <Select value={language} onChange={onLanguageChange} options={LANGUAGES.map(item => ({ value: item.code, label: item.label }))} ariaLabel={c.language} align="right" className="lp-language" panelClassName="lp-select-panel" />
      <button className="lp-nav-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? c.themeLight : c.themeDark}>{theme === 'dark' ? <Sun size={15} {...ICON} /> : <Moon size={15} {...ICON} />}</button>
      <button className="lp-nav-cta" onClick={onStart}>{signedIn ? c.panel : c.enter}</button>
    </div>
    <div className="lp-nav-menu">
      <button className="lp-glass lp-nav-burger" aria-label={menu ? c.menuClose : c.menuOpen} aria-expanded={menu} aria-controls="lp-mobile-menu" onClick={() => setMenu(!menu)}>
        <span className={menu ? 'is-open' : ''} aria-hidden="true"><i /><i /><i /></span>
      </button>
      {menu && <motion.ul id="lp-mobile-menu" className="lp-glass lp-nav-sheet" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        {links.map(([id, label]) => <li key={id}><button onClick={() => visit(id)}>{label}</button></li>)}
      </motion.ul>}
    </div>
  </nav>;
}

// Deterministic PRNG so the constellation is identical on every render and in every language.
function prng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
// Three owners at irregular spots.
const HUBS = [[0.2, 0.26], [0.8, 0.2], [0.6, 0.82]] as const;
type Word = { x: number; y: number; r: number; phase: number; speed: number };
type Task = { word: number; hub: number; detect: number; assign: number };
const WORDS: Word[] = (() => {
  const rand = prng(20260925);
  const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
  // Talk is uneven: a few dense tangents of different sizes and shapes, plus words scattered everywhere.
  const clusters = Array.from({ length: 7 }, () => ({ x: 0.1 + rand() * 0.8, y: 0.1 + rand() * 0.8, sx: 0.03 + rand() * 0.11, sy: 0.03 + rand() * 0.1 }));
  return Array.from({ length: 230 }, () => {
    const loose = rand() < 0.42, spot = clusters[Math.floor(rand() * clusters.length)];
    const x = loose ? rand() : spot.x + gauss() * spot.sx, y = loose ? rand() : spot.y + gauss() * spot.sy;
    return { x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.95, Math.max(0.05, y)), r: 1.1 + rand() * 1.6, phase: rand() * Math.PI * 2, speed: 0.5 + rand() * 0.9 };
  });
})();
// About one word in ten turns out to be a task; each goes mostly to the nearest owner.
const TASKS: Task[] = (() => {
  const rand = prng(915);
  const picked = new Set<number>();
  while (picked.size < 24) { const i = Math.floor(rand() * WORDS.length); if (WORDS[i].x > 0.08 && WORDS[i].x < 0.92) picked.add(i); }
  return [...picked].map(word => {
    const { x, y } = WORDS[word];
    const order = HUBS.map(([hx, hy], i) => [Math.hypot(hx - x, (hy - y) * 0.7), i] as const).sort((p, q) => p[0] - q[0]);
    return { word, hub: rand() < 0.8 ? order[0][1] : order[1][1], detect: rand(), assign: rand() };
  });
})();
const TASK_OF = new Map(TASKS.map((task, i) => [task.word, i]));
// The two demo tasks get a label pill once they reach their owner (Aziz, Malika).
const LABELLED: Array<[number, number]> = [[0, TASKS.findIndex(t => t.hub === 0)], [1, TASKS.findIndex(t => t.hub === 1)]];
const smooth = (p: number) => { const c = Math.min(1, Math.max(0, p)); return c * c * (3 - 2 * c); };
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

// One loop, in seconds: words drift, tasks get detected (ringed), handed to owners, held, then let go.
const CYCLE = { float: 1.4, detect: 3, assign: 5, hold: 3.5, release: 1.8 };
const CYCLE_TOTAL = CYCLE.float + CYCLE.detect + CYCLE.assign + CYCLE.hold + CYCLE.release;
function phases(seconds: number, still: boolean) {
  if (still) return { detect: 1, assign: 1, release: 0 };
  const t = seconds % CYCLE_TOTAL;
  return {
    detect: clamp01((t - CYCLE.float) / CYCLE.detect),
    assign: clamp01((t - CYCLE.float - CYCLE.detect) / CYCLE.assign),
    release: clamp01((t - CYCLE.float - CYCLE.detect - CYCLE.assign - CYCLE.hold) / CYCLE.release),
  };
}

/** Hero visual: every dot is a spoken word; MeetTask rings the tasks among them and hands each to its owner. */
export function TaskGraph({ c }: { c: ReturnType<typeof getPublicCopy> }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hubPills = useRef<Array<HTMLDivElement | null>>([]);
  const taskPills = useRef<Array<HTMLDivElement | null>>([]);
  const reduce = useReducedMotion();
  const labels = [c.sample.find(item => item.task)?.task ?? '', c.sample.filter(item => item.task)[1]?.task ?? ''];

  useEffect(() => {
    const el = canvas.current, box = stage.current;
    if (!el || !box) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0, frame = 0, visible = false, elapsed = 0, last = 0;
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = box.clientWidth; height = box.clientHeight;
      el.width = width * ratio; el.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = () => {
      const styles = getComputedStyle(box);
      const ink = styles.getPropertyValue('--ink').trim(), accent = styles.getPropertyValue('--accent').trim();
      const phase = phases(elapsed, Boolean(reduce));
      const letGo = smooth(phase.release);
      const clock = reduce ? 0 : elapsed;
      const ringOf = (task: Task) => smooth((phase.detect - task.detect * 0.8) / 0.2) * (1 - letGo);
      const linkOf = (task: Task) => smooth((phase.assign - task.assign * 0.8) / 0.2) * (1 - letGo);
      const place = (i: number, k: number) => {
        const word = WORDS[i], task = TASKS[TASK_OF.get(i) ?? -1];
        const pull = task ? 0.32 * k : 0, drift = reduce ? 0 : 6 - 4 * k;
        const [hx, hy] = task ? HUBS[task.hub] : [word.x, word.y];
        return [(word.x + (hx - word.x) * pull) * width + Math.sin(clock * word.speed * 0.7 + word.phase) * drift, (word.y + (hy - word.y) * pull) * height + Math.cos(clock * word.speed * 0.55 + word.phase * 1.3) * drift];
      };
      const counts = HUBS.map(() => 0);
      // How far the closest task is on its way to each owner: owners stay invisible until work heads their way.
      const reach = HUBS.map(() => 0);
      for (const task of TASKS) reach[task.hub] = Math.max(reach[task.hub], linkOf(task));
      ctx.clearRect(0, 0, width, height);
      // Links first, so dots sit on top of them.
      ctx.lineWidth = 1;
      for (const task of TASKS) {
        const k = linkOf(task);
        if (k <= 0) continue;
        if (k >= 0.98) counts[task.hub] += 1;
        const [x, y] = place(task.word, k);
        const hx = HUBS[task.hub][0] * width, hy = HUBS[task.hub][1] * height;
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.4 * k;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hx - x) * k, y + (hy - y) * k); ctx.stroke();
      }
      // Ordinary words fade back while tasks are being picked out.
      const wordAlpha = 0.5 - 0.26 * smooth(phase.detect) * (1 - letGo);
      ctx.fillStyle = ink;
      WORDS.forEach((word, i) => {
        const index = TASK_OF.get(i);
        const task = index === undefined ? null : TASKS[index];
        const ring = task ? ringOf(task) : 0;
        const [x, y] = place(i, task ? linkOf(task) : 0);
        const breath = 1 + 0.16 * Math.sin(clock * (0.6 + word.speed * 0.5) + word.phase);
        const r = word.r * breath + ring * 1.2;
        ctx.globalAlpha = task ? wordAlpha + (1 - wordAlpha) * ring : wordAlpha;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (ring > 0) {
          ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.globalAlpha = ring;
          ctx.beginPath(); ctx.arc(x, y, r + 3 + 3 * ring, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
        }
      });
      HUBS.forEach(([hx, hy], i) => {
        const x = hx * width, y = hy * height, grow = Math.min(1, counts[i] / 10), shown = smooth(reach[i] / 0.6);
        if (shown > 0) {
          ctx.fillStyle = accent; ctx.globalAlpha = (0.1 + 0.12 * grow) * shown;
          ctx.beginPath(); ctx.arc(x, y, (12 + 12 * grow) * shown, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = shown; ctx.fillStyle = ink;
          ctx.beginPath(); ctx.arc(x, y, 5 * shown, 0, Math.PI * 2); ctx.fill();
        }
        const pill = hubPills.current[i];
        if (!pill) return;
        const left = hx > 0.6;
        pill.dataset.side = left ? 'left' : 'right';
        // The owner's label only appears once their first task has arrived.
        pill.dataset.hidden = counts[i] > 0 ? 'false' : 'true';
        pill.style.transform = `translate(${x + (left ? -20 : 20)}px, ${y - 14}px)`;
        const count = pill.querySelector('b');
        if (count && count.textContent !== String(counts[i])) count.textContent = String(counts[i]);
      });
      ctx.globalAlpha = 1;
      LABELLED.forEach(([hub, index], i) => {
        const pill = taskPills.current[i];
        if (!pill || index < 0) return;
        // The label names the task where it was found, then fades as the task leaves for its owner,
        // so task names and owner names are never shown side by side.
        const task = TASKS[index], k = linkOf(task), ring = ringOf(task);
        const [x, y] = place(task.word, k);
        pill.style.transform = `translate(${x}px, ${y}px)`;
        pill.style.opacity = String(smooth((ring - 0.6) / 0.4) * (1 - smooth(k / 0.35)));
        // Point the label away from its owner, but flip whenever that side would run off the stage.
        const label = pill.firstElementChild as HTMLElement | null;
        const w = (label?.offsetWidth ?? 0) + 12, h = (label?.offsetHeight ?? 0) + 40;
        let side = HUBS[hub][0] > WORDS[task.word].x ? 'left' : 'right';
        if (side === 'right' && x + w > width) side = 'left';
        if (side === 'left' && x - w < 0) side = 'right';
        let v = HUBS[hub][1] < WORDS[task.word].y ? 'down' : 'up';
        if (v === 'up' && y - h < 0) v = 'down';
        if (v === 'down' && y + h > height) v = 'up';
        pill.dataset.side = side; pill.dataset.v = v;
      });
    };
    const loop = (now: number) => {
      if (last) elapsed += Math.min(0.05, (now - last) / 1000);
      last = now;
      draw();
      if (visible) frame = requestAnimationFrame(loop);
    };
    // The clock only runs while the graph is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !reduce;
      cancelAnimationFrame(frame); last = 0;
      if (visible) frame = requestAnimationFrame(loop); else draw();
    });
    const sizes = new ResizeObserver(() => { resize(); draw(); });
    resize(); draw(); observer.observe(box); sizes.observe(box);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); sizes.disconnect(); };
  }, [reduce]);

  return <div ref={stage} className="lp-graph-stage" role="img" aria-label={c.graphAria}>
    <canvas ref={canvas} />
    {c.owners.slice(0, HUBS.length).map((owner, i) => <div key={owner} ref={el => { hubPills.current[i] = el; }} className="lp-graph-owner" data-hidden="true" aria-hidden="true"><i>{owner.split(' ').map(part => part[0]).join('').slice(0, 2)}</i><span>{owner}</span><b>0</b><small>{c.graphCount}</small></div>)}
    {labels.map((label, i) => <div key={i} ref={el => { taskPills.current[i] = el; }} className="lp-graph-task" aria-hidden="true"><span>{label}</span></div>)}
  </div>;
}

export function Landing({ onStart, signedIn = false, language, onLanguageChange }: { onStart: () => void; signedIn?: boolean; language: Language; onLanguageChange: (language: Language) => void }) {
  const c = getPublicCopy(language);
  const app = getCatalogue(language);
  const { theme } = useTheme();
  const sample = c.sample;
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'tasks' | 'moments'>('tasks');
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const demo = useRef<HTMLDivElement>(null);
  const demoInView = useInView(demo, { once: true, amount: 0.35 });

  // The sample plays itself the first time it scrolls into view; reduced motion shows the finished result instead.
  useEffect(() => {
    if (!demoInView) return;
    if (reduce) setStep(sample.length); else setPlaying(true);
  }, [demoInView, reduce, sample.length]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep(current => {
      if (current >= sample.length) { setPlaying(false); return current; }
      return current + 1;
    }), 2000);
    return () => window.clearInterval(timer);
  }, [playing, sample.length]);
  useEffect(() => {
    if (plan && !dialog.current?.open) dialog.current?.showModal();
    if (!plan && dialog.current?.open) dialog.current.close();
  }, [plan]);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  const items = sample.slice(0, step);
  const results = items.filter(item => mode === 'moments' || item.task);
  const highlight = sample.find(item => !item.task)?.moment ?? sample[0].moment;

  return <div className="mt-landing">
    <Nav c={c} language={language} onLanguageChange={onLanguageChange} signedIn={signedIn} onStart={onStart} go={go} />

    <main>
      <section className="lp-hero">
        <div className="lp-hero-top">
        <Reveal className="lp-hero-copy">
          <p className="lp-eyebrow">{c.heroEyebrow}</p>
          <h1>{c.hero[0]}<br /><span>{c.hero[1]}</span></h1>
          <p className="lp-lede">{c.heroText}</p>
          <div className="lp-actions">
            <button className="lp-btn lp-btn-solid" onClick={onStart}>{c.start}<ArrowUpRight size={16} {...ICON} /></button>
            <button className="lp-btn lp-btn-dashed" onClick={() => go('demo')}>{c.watchDemo}</button>
          </div>
        </Reveal>

        <Reveal className="lp-hero-graph" delay={0.08}><TaskGraph c={c} /></Reveal>
        </div>

        <Reveal delay={0.12}>
          {/* Mirrors the app's live meeting screen (pages/LiveMeeting.tsx) with the same classes and copy. */}
          <div id="demo" ref={demo} className="workspace-shell lp-app-demo">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                    <div className={`w-3 h-3 rounded-full ${playing ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{c.demoMeeting}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />00:{String(step * 12).padStart(2, '0')}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{app.live.participantsCount(3)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (step >= sample.length) setStep(1); setPlaying(!playing); }} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-all">
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? c.pause : step >= sample.length ? c.replay : c.play}
                  </button>
                  <button onClick={() => { setPlaying(false); setStep(1); }} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all" aria-label={c.restart}><RotateCcw className="w-4 h-4" /></button>
                  <button onClick={() => { setPlaying(false); setStep(sample.length); }} disabled={step >= sample.length} className="hidden sm:flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-200">
                    <PhoneOff className="w-4 h-4" />{app.live.endMeeting}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600" /><span className="font-bold text-sm text-slate-900 uppercase tracking-wider">{app.live.liveTranscription}</span></div>
                    <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${playing ? 'bg-green-500' : 'bg-amber-500'}`} /><span className="text-[10px] font-bold text-slate-500 uppercase">{playing ? app.live.stateListening : app.live.stateMuted}</span></div>
                  </div>
                  <div className="p-6 space-y-6 min-h-[340px]">
                    {items.map((line, i) => <motion.div key={i} className="flex gap-4" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">{line.speaker[0]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-slate-900">{line.speaker}</span><span className="text-[10px] font-medium text-slate-500">00:{String(i * 12).padStart(2, '0')}</span></div>
                        <p className="text-slate-600 leading-relaxed text-sm">{line.text}</p>
                      </div>
                    </motion.div>)}
                  </div>
                </div>

                <div className="meeting-insights min-h-[420px] flex flex-col rounded-3xl overflow-hidden" data-panel-theme={theme}>
                  <div className="insights-switch flex gap-1 m-4 p-1 shrink-0" role="group" aria-label={app.live.analysisMode}>
                    {(['tasks', 'moments'] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}
                      className="insights-mode flex flex-1 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold">
                      <span className="truncate">{option === 'tasks' ? app.live.aiDetectedTasks : app.live.highlightsMode}</span>
                      {mode === option && results.length > 0 && <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">{results.length}</span>}
                    </button>)}
                  </div>
                  <div className="insights-scroll relative flex-1 min-h-0 p-5 space-y-4" data-empty={results.length === 0} aria-live="polite">
                    <AiDiscoveryField mode={mode === 'tasks' ? 'tasks' : 'highlights'} background={results.length > 0} visible={results.length === 0} running={playing} />
                    {mode === 'tasks' && results.map((item, i) => <div key={`t-${i}`} className="relative bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fade-up">
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-400'}`}>{app.priority[i === 0 ? 'high' : 'medium']}</span>
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-2">{item.task}</h4>
                      <p className="text-[11px] text-slate-400">{app.live.deadlineLabel(item.detail)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.owner}</p>
                    </div>)}
                    {mode === 'moments' && results.map((item, i) => <article key={`m-${i}`} className="insights-note relative flex gap-3 rounded-2xl p-4">
                      <span aria-hidden="true" className="pt-0.5 text-[10px] font-semibold tabular-nums text-blue-400">{String(i + 1).padStart(2, '0')}</span>
                      <p className="min-w-0 text-[13px] leading-6 text-slate-200">{item.moment}</p>
                    </article>)}
                  </div>
                  <div className="px-5 py-3 border-t border-white/5 text-[10px] font-medium text-slate-400 flex flex-wrap gap-2 items-center justify-between shrink-0">
                    <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{app.live.scanEvery(10)}</span>
                    <span>{playing ? app.live.checkingShort : mode === 'tasks' ? c.taskCaption : c.momentCaption}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="lp-note">{c.sampleNote}</p>
        </Reveal>
      </section>

      <Reveal className="lp-strip">
        {[Mic, Sparkles, CheckCheck, Layers3].map((Icon, i) => <p key={i}><Icon size={17} {...ICON} />{c.capabilities[i]}</p>)}
      </Reveal>

      <LayersSection c={c} />


      <section id="features" className="lp-section">
        <Reveal className="lp-heading"><h2>{c.featuresTitle[0]}<br /><span>{c.featuresTitle[1]}</span></h2><p>{c.featuresText}</p></Reveal>
        <div className="lp-bento">
          <Reveal className="lp-cell lp-cell-photo">
            <img src={PHOTOS.notes} alt="" width={1200} height={800} loading="lazy" />
            <div><h3>{c.features[0].title}</h3><p>{c.features[0].text}</p></div>
          </Reveal>
          <Reveal className="lp-cell lp-cell-ink" delay={0.08}>
            <blockquote><mark>{highlight}</mark></blockquote>
            <div><h3>{c.features[1].title}</h3><p>{c.features[1].text}</p></div>
          </Reveal>
          <Reveal className="lp-cell lp-cell-side" delay={0.16}>
            <img src={PHOTOS.desk} alt="" width={900} height={600} loading="lazy" />
            <div><h3>{c.features[2].title}</h3><p>{c.features[2].text}</p></div>
          </Reveal>
        </div>
      </section>

      <section id="pricing" className="lp-section">
        <Reveal className="lp-heading"><h2>{c.pricingTitle[0]}<br /><span>{c.pricingTitle[1]}</span></h2><p>{c.pricingText}</p></Reveal>
        <Reveal className="lp-plans">{c.plans.map(item => <article key={item.name} className={`lp-plan ${item.featured ? 'is-featured' : ''}`}>
          <div className="lp-plan-head"><h3>{item.name}</h3>{item.featured && <span className="lp-mono">{c.teamBadge}</span>}</div>
          <p className="lp-plan-tag">{item.tag}</p>
          <p className="lp-price">{c.price}</p>
          <p className="lp-plan-tag">{c.pricePending}</p>
          <ul>{item.features.map(feature => <li key={feature}><Check size={15} {...ICON} />{feature}</li>)}</ul>
          <button className={`lp-btn ${item.featured ? 'lp-btn-invert' : 'lp-btn-dashed'}`} onClick={() => setPlan(item.name)}>{c.viewPlan}<ArrowUpRight size={15} {...ICON} /></button>
        </article>)}</Reveal>
      </section>

      <section className="lp-section lp-faq">
        <Reveal><h2>{c.faqTitle}</h2></Reveal>
        <div>{c.faq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} {...ICON} /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="lp-section">
        <Reveal className="lp-final">
          <h2>{c.finalTitle[0]}<br /><span>{c.finalTitle[1]}</span></h2>
          <button className="lp-btn lp-btn-invert" onClick={onStart}>{c.start}<ArrowRight size={16} {...ICON} /></button>
        </Reveal>
      </section>
    </main>

    <footer className="lp-footer"><a className="lp-brand" href="#/landing" aria-label={c.home}><Wordmark /></a><p>{c.footer}</p><p>© {new Date().getFullYear()} MeetTask</p></footer>

    <dialog ref={dialog} className="lp-dialog" onCancel={() => setPlan(null)} onClose={() => setPlan(null)}>
      <h2>{plan} {c.planSuffix}</h2><p>{c.planText}</p>
      <div><button className="lp-btn lp-btn-dashed" onClick={() => setPlan(null)}>{c.close}</button><button className="lp-btn lp-btn-solid" onClick={() => { setPlan(null); onStart(); }}>{c.continue}<ArrowRight size={15} {...ICON} /></button></div>
    </dialog>
  </div>;
}
