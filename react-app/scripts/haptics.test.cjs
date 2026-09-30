const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(native, fail = false) {
  const calls = [];
  let imports = 0;
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/haptics.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const exported = {};
  vm.runInNewContext(code, {
    exports: exported,
    require: (name) => {
      if (name === "@capacitor/core")
        return { Capacitor: { isNativePlatform: () => native } };
      assert.equal(name, "@capacitor/haptics");
      imports++;
      if (fail) throw new Error("native plugin unavailable");
      return {
        Haptics: {
          impact: async (value) => calls.push(value.style),
          notification: async (value) => calls.push(value.type),
        },
        ImpactStyle: { Light: "light", Medium: "medium" },
        NotificationType: { Success: "success" },
      };
    },
  });
  return { haptic: exported.haptic, calls, imports: () => imports };
}
test("Web/PWA haptics returns without importing native plugin", async () => {
  const module = load(false);
  for (const kind of ["light", "medium", "success"]) await module.haptic(kind);
  assert.equal(module.imports(), 0);
  assert.deepEqual(module.calls, []);
});
test("native haptics maps feedback kinds and silently handles unavailable plugin", async () => {
  const module = load(true);
  await module.haptic();
  await module.haptic("medium");
  await module.haptic("success");
  assert.deepEqual(module.calls, ["light", "medium", "success"]);
  await load(true, true).haptic("light");
});
