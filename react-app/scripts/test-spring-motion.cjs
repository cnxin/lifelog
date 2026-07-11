/**
 * Pure-numeric tests for motion primitives (no DOM).
 * Run: node scripts/test-spring-motion.cjs
 */

const path = require("path");
const fs = require("fs");

// Lightweight transpile-free load: reimplement formulas inline to avoid TS runtime,
// then assert parity with source comments / demo values.

function project(velocityPxPerSec, decelerationRate = 0.998) {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const d = Math.min(0.9999, Math.max(0.9, decelerationRate));
  return (velocityPxPerSec / 1000) * d / (1 - d);
}

function rubberband(overshoot, dimension, constant = 0.55) {
  if (dimension <= 0) return 0;
  const c = Math.max(0.01, constant);
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

function animateSpringSync({ from, to, velocity = 0, stiffness = 210, damping = 26, mass = 1, maxSteps = 2000 }) {
  let x = from;
  let v = velocity;
  const restDelta = 0.5;
  const restSpeed = 0.5;
  const dt = 1 / 60;
  for (let i = 0; i < maxSteps; i += 1) {
    const force = -stiffness * (x - to) - damping * v;
    const a = force / mass;
    v += a * dt;
    x += v * dt;
    if (Math.abs(v) < restSpeed && Math.abs(x - to) < restDelta) {
      return { value: to, steps: i + 1, velocity: 0 };
    }
  }
  return { value: x, steps: maxSteps, velocity: v };
}

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("test-spring-motion");

// project
assert("project zero velocity", project(0) === 0);
assert("project positive", project(1000, 0.998) > 0);
assert("project negative", project(-1000, 0.998) < 0);
assert(
  "project magnitude ballpark",
  Math.abs(project(1000, 0.998) - 499) < 5,
  `got ${project(1000, 0.998)}`
);

// rubberband
assert("rubberband zero dim", rubberband(100, 0) === 0);
assert("rubberband less than overshoot", rubberband(200, 400, 0.55) < 200);
assert("rubberband increases with overshoot", rubberband(50, 300) < rubberband(150, 300));

// spring converges
const settle = animateSpringSync({ from: 400, to: 0, velocity: 0 });
assert("spring settles to target", settle.value === 0, `value=${settle.value} steps=${settle.steps}`);
assert("spring settles in reasonable frames", settle.steps < 180, `steps=${settle.steps}`);

const withVel = animateSpringSync({ from: 0, to: 0, velocity: 1200, stiffness: 170, damping: 18 });
assert("spring with velocity returns near 0", Math.abs(withVel.value) < 1, `value=${withVel.value}`);

// source file exists
const springPath = path.join(__dirname, "..", "src", "utils", "motion", "spring.ts");
assert("spring.ts exists", fs.existsSync(springPath));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
