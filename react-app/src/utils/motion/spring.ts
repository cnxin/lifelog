/**
 * Interruptible spring motion primitives.
 * Formulae aligned with Apple Designing Fluid Interfaces / demo/apple-feel-compare.html
 */

export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass?: number;
};

/** Critically damped default for UI reposition */
export const SPRING_DEFAULT: SpringConfig = {
  stiffness: 210,
  damping: 26,
  mass: 1
};

/** Slight overshoot for momentum / flick settle */
export const SPRING_BOUNCY: SpringConfig = {
  stiffness: 170,
  damping: 18,
  mass: 1
};

/**
 * Apple exponential-decay projection (not textbook v²/2a).
 * @param velocityPxPerSec release velocity in px/s
 * @param decelerationRate ~0.998 normal scroll, ~0.99 snappier
 */
export function project(velocityPxPerSec: number, decelerationRate = 0.998): number {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const d = Math.min(0.9999, Math.max(0.9, decelerationRate));
  return ((velocityPxPerSec / 1000) * d) / (1 - d);
}

/**
 * Progressive resistance past a bound (rubber-band).
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0;
  const c = Math.max(0.01, constant);
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

export type AnimateSpringOptions = {
  from: number;
  to: number;
  velocity?: number;
  spring?: SpringConfig;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: (value: number) => void;
  restDelta?: number;
  restSpeed?: number;
  /** hard stop after this many frames (WebView background throttle safety) */
  maxFrames?: number;
};

export type SpringAnimation = {
  stop: () => void;
  readonly value: number;
  readonly velocity: number;
};

/**
 * Semi-implicit Euler spring. Interruptible via stop(); read live value/velocity
 * and start a new animateSpring from presentation values.
 */
export function animateSpring(options: AnimateSpringOptions): SpringAnimation {
  const {
    from,
    to,
    velocity: initialVelocity = 0,
    spring = SPRING_DEFAULT,
    onUpdate,
    onComplete,
    restDelta = 0.5,
    restSpeed = 0.5,
    maxFrames = 600
  } = options;

  const mass = spring.mass ?? 1;
  const stiffness = spring.stiffness;
  const damping = spring.damping;

  let x = from;
  let v = initialVelocity;
  let frame = 0;
  let raf = 0;
  let last = typeof performance !== "undefined" ? performance.now() : 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000)) || 0.016;
    last = now;

    const force = -stiffness * (x - to) - damping * v;
    const a = force / mass;
    v += a * dt;
    x += v * dt;

    onUpdate(x, v);

    if (Math.abs(v) < restSpeed && Math.abs(x - to) < restDelta) {
      x = to;
      v = 0;
      onUpdate(to, 0);
      onComplete?.(to);
      return;
    }

    frame += 1;
    if (frame > maxFrames) {
      x = to;
      v = 0;
      onUpdate(to, 0);
      onComplete?.(to);
      return;
    }

    raf = requestAnimationFrame(tick);
  };

  if (typeof requestAnimationFrame === "undefined") {
    onUpdate(to, 0);
    onComplete?.(to);
    return {
      stop() {
        stopped = true;
      },
      get value() {
        return to;
      },
      get velocity() {
        return 0;
      }
    };
  }

  raf = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    },
    get value() {
      return x;
    },
    get velocity() {
      return v;
    }
  };
}

/**
 * Instant snap when reduced motion is preferred.
 */
export function animateOrSnap(
  reducedMotion: boolean,
  options: AnimateSpringOptions
): SpringAnimation {
  if (reducedMotion) {
    let stopped = false;
    options.onUpdate(options.to, 0);
    queueMicrotask(() => {
      if (!stopped) options.onComplete?.(options.to);
    });
    return {
      stop() {
        stopped = true;
      },
      get value() {
        return options.to;
      },
      get velocity() {
        return 0;
      }
    };
  }
  return animateSpring(options);
}
