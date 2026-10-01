import { dayStatus, validDate, type Day } from "./domain";

export type CelebrationTone = "rose" | "amber" | "sage";
export const CELEBRATED_KEY = "lifelog-days:celebrated";

export function shouldCelebrate(featured: Day | null | undefined, today: string, stored: string | null): boolean {
  return !!featured && validDate(today) && dayStatus(featured, today).delta === 0 &&
    stored !== `${featured.id}:${today}`;
}

const colors: Record<CelebrationTone, string> = { rose: "#a26a58", amber: "#997535", sage: "#617650" };
function mix(hex: string, target: number, amount: number): string {
  const rgb = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16));
  return `rgb(${rgb.map(value => Math.round(value + (target - value) * amount)).join(",")})`;
}
type Particle = {
  x: number; speed: number; drift: number; size: number; phase: number;
  sway: number; angle: number; spin: number; born: number; shape: number; color: string;
};

/** A bounded, host-local one-shot paint effect; no layout reads in the rAF loop. */
export function playCelebration(host: HTMLElement, tone: CelebrationTone, opts?: { duration?: number }): () => void {
  const duration = opts?.duration ?? 2600;
  if (!Number.isFinite(duration) || duration <= 0 || !host.isConnected) return () => {};
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches) return () => {};
  const rect = host.getBoundingClientRect();
  const originalPosition = host.style.position;
  const positioned = getComputedStyle(host).position === "static";
  const canvas = document.createElement("canvas");
  canvas.className = "celebration-canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none", zIndex: "2",
  });
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  if (positioned) host.style.position = "relative";
  host.append(canvas);
  let width = rect.width, height = rect.height;
  function sizeCanvas(w: number, h: number) {
    width = w; height = h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas(width, height);
  const resize = () => {
    const next = host.getBoundingClientRect();
    sizeCanvas(next.width, next.height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener("resize", resize);
  const palette = [colors[tone], mix(colors[tone], 255, .2), mix(colors[tone], 0, .15)];
  const total = 90 + Math.floor(Math.random() * 31);
  const spawnDuration = Math.min(500, duration);
  const particles: Particle[] = [];
  let elapsed = 0, previous: number | null = null, frame = 0, stopped = false;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", visibility);
    motion.removeEventListener("change", reduce);
    window.removeEventListener("resize", resize);
    observer.disconnect();
    canvas.remove();
    if (positioned && host.style.position === "relative") host.style.position = originalPosition;
  };
  function tick(timestamp: number) {
    frame = 0;
    if (stopped) return;
    if (!host.isConnected) { cancel(); return; }
    if (document.hidden) { previous = null; return; }
    if (previous !== null) elapsed += Math.max(0, timestamp - previous);
    previous = timestamp;
    if (elapsed >= duration) { cancel(); return; }
    const spawned = Math.min(total, 1 + Math.floor(elapsed / spawnDuration * total));
    while (particles.length < spawned) {
      const index = particles.length, color = Math.random();
      particles.push({
        x: Math.random() * width, speed: 60 + Math.random() * 80, drift: Math.random() * 60 - 30,
        size: 4 + Math.random() * 5, phase: Math.random() * Math.PI * 2, sway: 6 + Math.random() * 8,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() * 2 - 1) * 2.4,
        born: index / total * spawnDuration, shape: index % 3,
        color: color < .1 ? "#fff9ec" : palette[Math.min(2, Math.floor((color - .1) / .9 * 3))],
      });
    }
    context!.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const age = Math.max(0, elapsed - particle.born) / 1000;
      const y = -10 + particle.speed * age + 6 * age * age;
      const fade = Math.min(1, Math.max(0, (height - y) / 20));
      if (!fade || y < -particle.size) continue;
      const x = particle.x + particle.drift * age +
        (Math.sin(age * 2 + particle.phase) - Math.sin(particle.phase)) * particle.sway;
      context!.save();
      context!.translate(x, y);
      context!.rotate(particle.angle + particle.spin * age);
      context!.globalAlpha = .62 * fade * Math.min(1, (duration - elapsed) / 200);
      context!.fillStyle = particle.color;
      if (particle.shape === 1) {
        context!.beginPath();
        context!.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        context!.fill();
      } else {
        const w = particle.shape === 2 ? particle.size * .28 : particle.size;
        const h = particle.shape === 2 ? particle.size : particle.size * .65;
        context!.fillRect(-w / 2, -h / 2, w, h);
      }
      context!.restore();
    }
    frame = requestAnimationFrame(tick);
  }
  function visibility() {
    cancelAnimationFrame(frame);
    previous = null;
    if (!document.hidden && !stopped) frame = requestAnimationFrame(tick);
  }
  function reduce() { if (motion.matches) cancel(); }
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", reduce);
  if (!document.hidden) frame = requestAnimationFrame(tick);
  return cancel;
}
