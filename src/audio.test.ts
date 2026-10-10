import { test } from "node:test";
import assert from "node:assert/strict";
import { TimerAudio } from "./audio.ts";
import { transitions } from "./engine.ts";

const settings = { volume: 1, muted: false, keepAwake: false };
function setup() {
  const tones: { start?: number; stop?: number; cancelled?: boolean }[] = [];
  class FakeContext {
    currentTime = 10;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      const record: (typeof tones)[number] = {};
      tones.push(record);
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target: unknown) {
          return target;
        },
        start(t: number) {
          record.start = t;
        },
        stop(t?: number) {
          if (t === undefined) record.cancelled = true;
          else record.stop = t;
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
  return { audio, tones };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test("Beeps previews three 150 ms tones with one second of silence between", () => {
  const { audio, tones } = setup();
  audio.transition("beeps", settings);
  assert.equal(tones.length, 3);
  tones.forEach((tone) => close(tone.stop! - tone.start!, 0.15));
  close(tones[1].start! - tones[0].stop!, 1);
  close(tones[2].start! - tones[1].stop!, 1);
  audio.transition("beeps", { ...settings, muted: true });
  audio.transition("none", settings);
  assert.equal(tones.length, 3);
});
test("incoming beeps play in the previous interval and finish at its end", () => {
  const { audio, tones } = setup();
  audio.transition("beeps", settings, 10000);
  assert.equal(tones.length, 3);
  close(tones[0].start!, 17.55);
  close(tones[1].start!, 18.7);
  close(tones[2].start!, 19.85);
  close(tones[2].stop!, 20);
  assert.ok(tones.every((tone) => tone.start! > 10 && tone.stop! <= 20));
});
test("all transition sounds finish by the upcoming boundary", () => {
  for (const sound of transitions.filter((sound) => sound !== "none")) {
    const { audio, tones } = setup();
    audio.transition(sound, settings, 5000);
    assert.ok(tones.length > 0);
    assert.ok(
      tones.every((tone) => tone.start! > 10 && tone.stop! <= 15.000001),
    );
    close(Math.max(...tones.map((tone) => tone.stop!)), 15);
  }
});
test("pause cancels pending beeps and resume does not replay expired notes", () => {
  const { audio, tones } = setup();
  audio.transition("beeps", settings, 10000);
  audio.stopTones();
  assert.ok(tones.every((tone) => tone.cancelled));
  audio.transition("beeps", settings, 1500);
  const resumed = tones.slice(3);
  assert.equal(resumed.length, 2);
  close(resumed[0].start!, 10.2);
  close(resumed[1].start!, 11.35);
  close(resumed[1].stop!, 11.5);
});
test("short intervals omit notes that do not fit, without playing after the boundary", () => {
  const { audio, tones } = setup();
  audio.transition("beeps", settings, 1000);
  assert.equal(tones.length, 1);
  close(tones[0].start!, 10.85);
  close(tones[0].stop!, 11);
  audio.transition("beeps", settings, 0);
  assert.equal(tones.length, 1);
});
test("previews do not cancel the running timer's pending transition", () => {
  const { audio, tones } = setup();
  audio.transition("beeps", settings, 10000);
  audio.previewTransition("bell", settings);
  assert.ok(tones.slice(0, 3).every((tone) => !tone.cancelled));
  audio.stopPreview();
  assert.ok(tones.slice(3).every((tone) => tone.cancelled));
  assert.ok(tones.slice(0, 3).every((tone) => !tone.cancelled));
});
