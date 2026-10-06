const test = require('node:test');
const assert = require('node:assert/strict');
const { timingInformation, printTiming } = require('./gates.cjs');

test('H3 half-time goal is not an acceptance threshold; warning starts strictly above 180 seconds', () => {
  for (const duration of [0, 45000, 45001, 90000, 180000]) {
    const timing = timingInformation(duration);
    assert.equal(timing.timingPolicy, 'informational');
    assert.equal(timing.timingWarningThresholdSeconds, 180);
    assert.equal(timing.timingWarning, false);
    assert.equal(Object.hasOwn(timing, 'performanceTargetMet'), false);
  }
  assert.equal(timingInformation(180001).timingWarning, true);
});

test('timing output retains total duration and warnings never alter the exit code', () => {
  const previousExitCode = process.exitCode;
  const messages = [], warnings = [];
  const logger = { log: message => messages.push(message), warn: message => warnings.push(message) };
  for (const durationMs of [51000, 181000])
    printTiming({ durationMs, referenceSeconds: 90, ...timingInformation(durationMs) }, logger);
  assert.match(messages[0], /TOTAL 51\.00s; prior eight gates 90s; timing is informational/);
  assert.match(messages[1], /TOTAL 181\.00s/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /WARNING:.*180s.*exit code unchanged/);
  assert.equal(process.exitCode, previousExitCode);
});
