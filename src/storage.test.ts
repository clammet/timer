import { test } from "node:test";
import assert from "node:assert/strict";
import { preset } from "./engine.ts";
import { emptyStore, isTimer, parseStore } from "./storage.ts";

test("timers, custom audio, settings and active session round-trip", () => {
  const timer = preset("Tabata");
  timer.rounds[1].intervals[0].transition = "loud-beep";
  const store = {
    ...emptyStore(),
    timers: [timer],
    sounds: [
      { id: "audio", name: "Track", data: "data:audio/mp3;base64,AA==" },
    ],
    settings: { volume: 0.5, muted: true, keepAwake: false },
    session: { timer, elapsed: 9500, startedAt: 12000 },
  };
  assert.deepEqual(parseStore(JSON.stringify(store)), store);
});
test("corrupt or unsupported storage safely recovers", () => {
  assert.deepEqual(parseStore("{bad json"), emptyStore());
  assert.deepEqual(parseStore("null"), emptyStore());
  assert.deepEqual(parseStore('{"version":9}'), emptyStore());
});
test("rejects malformed nested timers and unsafe media URLs", () => {
  const valid = preset("Rounds");
  const invalid = structuredClone(valid);
  invalid.rounds[0].intervals[0].duration = 0;
  assert.equal(isTimer(invalid), false);
  const raw = {
    version: 1,
    timers: [invalid, valid, { ...valid, cycles: -1 }],
    sounds: [{ id: "a", name: "Bad", data: "https://example.com/track.mp3" }],
    session: { timer: valid, elapsed: -5, startedAt: null },
  };
  const parsed = parseStore(JSON.stringify(raw));
  assert.deepEqual(parsed.timers, [valid]);
  assert.deepEqual(parsed.sounds, []);
  assert.equal(parsed.session, null);
});
test("settings are bounded and invalid types get defaults", () => {
  const parsed = parseStore(
    JSON.stringify({ version: 1, settings: { volume: 4, muted: "yes" } }),
  );
  assert.deepEqual(parsed.settings, {
    volume: 1,
    muted: false,
    keepAwake: true,
  });
});
