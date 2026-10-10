import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preset,
  totalDuration,
  positionAt,
  transitionCueAt,
  elapsedAt,
  formatTime,
  interval,
  uid,
} from "./engine.ts";

test("presets follow the requested durations and repeats", () => {
  const tabata = preset("Tabata");
  assert.deepEqual(
    tabata.rounds[0].intervals.map((i) => i.duration),
    [10, 20, 60],
  );
  assert.equal(tabata.rounds[0].repeat, 10);
  assert.equal(totalDuration(tabata), 900000);
  assert.equal(totalDuration(preset("Rounds")), 40000);
  assert.ok(
    tabata.rounds[0].intervals.every(
      (i) => i.sound === null && i.transition === "beeps",
    ),
  );
});
test("boundaries advance through intervals, repeats, rounds and cycles", () => {
  const timer = preset("Rounds");
  timer.rounds[0].repeat = 2;
  timer.rounds.push({
    id: uid(),
    name: "Extra",
    repeat: 2,
    intervals: [interval("Extra", 5)],
  });
  timer.cycles = 2;
  assert.equal(totalDuration(timer), 180000);
  assert.equal(positionAt(timer, 9999)?.interval.name, "Prepare");
  assert.equal(positionAt(timer, 10000)?.interval.name, "Work");
  assert.equal(positionAt(timer, 20000)?.interval.name, "Rest");
  assert.equal(positionAt(timer, 40000)?.repeat, 2);
  assert.equal(positionAt(timer, 80000)?.interval.name, "Extra");
  assert.equal(positionAt(timer, 85000)?.repeat, 2);
  assert.equal(positionAt(timer, 90000)?.cycle, 2);
  assert.equal(positionAt(timer, 179999)?.remaining, 1);
  assert.equal(positionAt(timer, 180000), null);
  assert.equal(positionAt(timer, 900000), null);
});
test("elapsed time survives delayed ticks, pause, resume and completion", () => {
  const timer = preset("Rounds");
  const session = { timer, elapsed: 5000, startedAt: 1000 };
  assert.equal(elapsedAt(session, 16000), 20000);
  assert.equal(
    elapsedAt({ ...session, elapsed: 20000, startedAt: null }, 90000),
    20000,
  );
  assert.equal(
    elapsedAt({ ...session, elapsed: 20000, startedAt: 90000 }, 95000),
    25000,
  );
  assert.equal(elapsedAt(session, 100000), 40000);
  assert.equal(elapsedAt(session, 0), 5000);
});
test("large repeat counts locate the last interval without expansion", () => {
  const timer = preset("Tabata");
  timer.cycles = 100;
  timer.rounds[0].repeat = 100;
  const end = totalDuration(timer);
  const position = positionAt(timer, end - 1)!;
  assert.equal(position.cycle, 100);
  assert.equal(position.repeat, 100);
  assert.equal(position.interval.name, "Rest");
  assert.equal(position.end, end);
});
test("countdown rounds partial seconds up and formats hours", () => {
  assert.equal(formatTime(1), "00:01");
  assert.equal(formatTime(60001), "01:01");
  assert.equal(formatTime(3600000), "1:00:00");
  assert.equal(formatTime(0), "00:00");
});

test("transition cues use the upcoming interval's selection across repeats and cycles", () => {
  const timer = preset("Rounds");
  timer.rounds[0].intervals[0].transition = "click";
  timer.rounds[0].intervals[1].transition = "bell";
  timer.rounds[0].intervals[2].transition = "none";
  timer.rounds[0].repeat = 2;
  timer.cycles = 2;
  assert.deepEqual(transitionCueAt(timer, 0), {
    sound: "bell",
    remaining: 10000,
  });
  assert.deepEqual(transitionCueAt(timer, 9000), {
    sound: "bell",
    remaining: 1000,
  });
  assert.deepEqual(transitionCueAt(timer, 10000), {
    sound: "none",
    remaining: 10000,
  });
  assert.deepEqual(transitionCueAt(timer, 39000), {
    sound: "click",
    remaining: 1000,
  });
  assert.deepEqual(transitionCueAt(timer, 79000), {
    sound: "click",
    remaining: 1000,
  });
  assert.equal(transitionCueAt(timer, 159000), null);
  assert.equal(transitionCueAt(timer, 160000), null);
});
