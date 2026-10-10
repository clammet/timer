export const iconNames = [
  "zap",
  "dumbbell",
  "coffee",
  "heart",
  "wind",
  "flame",
  "timer",
  "footprints",
  "moon",
  "music",
] as const;
export type IconName = (typeof iconNames)[number];
export const transitions = [
  "none",
  "beeps",
  "bell",
  "chime",
  "rise",
  "click",
] as const;
export type Transition = (typeof transitions)[number];
export interface Interval {
  id: string;
  name: string;
  duration: number;
  color: string;
  icon: IconName;
  sound: string | null;
  transition: Transition;
}
export interface Round {
  id: string;
  name: string;
  repeat: number;
  intervals: Interval[];
}
export interface Timer {
  id: string;
  name: string;
  cycles: number;
  rounds: Round[];
}
export interface Session {
  timer: Timer;
  elapsed: number;
  startedAt: number | null;
}
export const colors = [
  "#ee6b4d",
  "#e9bc53",
  "#80af91",
  "#7e9fc7",
  "#a591be",
  "#e59ca9",
  "#659fa4",
  "#9a9d91",
];
export const uid = () => crypto.randomUUID();
export function interval(
  name = "Work",
  duration = 20,
  color = colors[0],
  icon: IconName = "dumbbell",
): Interval {
  return {
    id: uid(),
    name,
    duration,
    color,
    icon,
    sound: null,
    transition: "beeps",
  };
}
export function preset(kind: "Tabata" | "Rounds" | "Custom"): Timer {
  return {
    id: uid(),
    name: kind === "Custom" ? "New timer" : kind,
    cycles: 1,
    rounds: [
      {
        id: uid(),
        name: "Round 1",
        repeat: kind === "Tabata" ? 10 : 1,
        intervals:
          kind === "Custom"
            ? [interval()]
            : [
                interval("Prepare", 10, colors[1], "wind"),
                interval("Work", kind === "Tabata" ? 20 : 10),
                interval(
                  "Rest",
                  kind === "Tabata" ? 60 : 20,
                  colors[2],
                  "coffee",
                ),
              ],
      },
    ],
  };
}
export const roundDuration = (round: Round) =>
  round.intervals.reduce((total, item) => total + item.duration * 1000, 0);
export const cycleDuration = (timer: Timer) =>
  timer.rounds.reduce(
    (total, round) => total + roundDuration(round) * round.repeat,
    0,
  );
export const totalDuration = (timer: Timer) =>
  cycleDuration(timer) * timer.cycles;
export const elapsedAt = (session: Session, now = Date.now()) =>
  Math.min(
    totalDuration(session.timer),
    Math.max(
      0,
      session.elapsed +
        (session.startedAt === null ? 0 : Math.max(0, now - session.startedAt)),
    ),
  );
export interface Position {
  interval: Interval;
  round: Round;
  cycle: number;
  repeat: number;
  remaining: number;
  start: number;
  end: number;
  key: string;
}
// Locate an interval arithmetically, without expanding repeats or cycles.
export function positionAt(timer: Timer, elapsed: number): Position | null {
  const cycleLength = cycleDuration(timer);
  if (cycleLength <= 0 || elapsed >= totalDuration(timer)) return null;
  const safeElapsed = Math.max(0, elapsed);
  const cycle = Math.floor(safeElapsed / cycleLength);
  let offset = cycle * cycleLength;
  for (const round of timer.rounds) {
    const length = roundDuration(round);
    const block = length * round.repeat;
    if (safeElapsed < offset + block) {
      const repeat = Math.floor((safeElapsed - offset) / length);
      offset += repeat * length;
      for (const item of round.intervals) {
        const end = offset + item.duration * 1000;
        if (safeElapsed < end)
          return {
            interval: item,
            round,
            cycle: cycle + 1,
            repeat: repeat + 1,
            remaining: end - safeElapsed,
            start: offset,
            end,
            key: `${cycle}:${round.id}:${repeat}:${item.id}`,
          };
        offset = end;
      }
    }
    offset += block;
  }
  return null;
}
// The upcoming interval's cue belongs to the end of the current interval.
export function transitionCueAt(
  timer: Timer,
  elapsed: number,
): { sound: Transition; remaining: number } | null {
  const current = positionAt(timer, elapsed);
  if (!current) return null;
  const next = positionAt(timer, current.end);
  return next
    ? { sound: next.interval.transition, remaining: current.remaining }
    : null;
}
export function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
