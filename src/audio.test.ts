import { test } from "node:test";
import assert from "node:assert/strict";
import { TimerAudio } from "./audio.ts";

test("Beeps schedules three 150 ms tones with one second of silence between", () => {
  const tones: { start?: number; stop?: number }[] = [];
  class FakeContext {
    currentTime = 10;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      const record: { start?: number; stop?: number } = {};
      tones.push(record);
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target: unknown) {
          return target;
        },
        start(t: number) {
          record.start = t;
        },
        stop(t: number) {
          record.stop = t;
        },
        disconnect() {},
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }
  Object.assign(globalThis, { AudioContext: FakeContext });
  const audio = new TimerAudio();
  audio.unlock();
  audio.transition("beeps", { volume: 1, muted: false, keepAwake: false });
  assert.equal(tones.length, 3);
  tones.forEach((tone) =>
    assert.ok(Math.abs(tone.stop! - tone.start! - 0.15) < 0.00001),
  );
  assert.ok(Math.abs(tones[1].start! - tones[0].stop! - 1) < 0.00001);
  assert.ok(Math.abs(tones[2].start! - tones[1].stop! - 1) < 0.00001);
  audio.transition("beeps", { volume: 1, muted: true, keepAwake: false });
  assert.equal(tones.length, 3);
  audio.transition("none", { volume: 1, muted: false, keepAwake: false });
  assert.equal(tones.length, 3);
});
