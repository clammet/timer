import { iconNames, transitions, type Timer, type Session } from "./engine.ts";
export interface Sound {
  id: string;
  name: string;
  data: string;
}
export interface Settings {
  volume: number;
  muted: boolean;
  keepAwake: boolean;
}
export interface Store {
  version: 1;
  timers: Timer[];
  sounds: Sound[];
  settings: Settings;
  session: Session | null;
}
export const STORAGE_KEY = "tempo.v1";
export const emptyStore = (): Store => ({
  version: 1,
  timers: [],
  sounds: [],
  settings: { volume: 0.75, muted: false, keepAwake: true },
  session: null,
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const count = (v: unknown, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max;
export function isTimer(value: unknown): value is Timer {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !count(value.cycles, 100) ||
    !Array.isArray(value.rounds) ||
    !value.rounds.length ||
    value.rounds.length > 100
  )
    return false;
  return value.rounds.every(
    (r) =>
      object(r) &&
      typeof r.id === "string" &&
      typeof r.name === "string" &&
      count(r.repeat, 100) &&
      Array.isArray(r.intervals) &&
      r.intervals.length > 0 &&
      r.intervals.length <= 100 &&
      r.intervals.every(
        (i) =>
          object(i) &&
          typeof i.id === "string" &&
          typeof i.name === "string" &&
          count(i.duration, 86399) &&
          typeof i.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(i.color) &&
          iconNames.includes(i.icon as never) &&
          (i.sound === null || typeof i.sound === "string") &&
          transitions.includes(i.transition as never),
      ),
  );
}
export function parseStore(raw: string | null): Store {
  const fallback = emptyStore();
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1) return fallback;
    if (Array.isArray(value.timers))
      fallback.timers = value.timers.filter(isTimer);
    if (Array.isArray(value.sounds))
      fallback.sounds = value.sounds.filter(
        (s): s is Sound =>
          object(s) &&
          typeof s.id === "string" &&
          typeof s.name === "string" &&
          typeof s.data === "string" &&
          /^data:(audio\/|video\/|application\/ogg)/.test(s.data),
      );
    if (object(value.settings)) {
      const s = value.settings;
      fallback.settings = {
        volume:
          typeof s.volume === "number" && Number.isFinite(s.volume)
            ? Math.min(1, Math.max(0, s.volume))
            : 0.75,
        muted: typeof s.muted === "boolean" ? s.muted : false,
        keepAwake: typeof s.keepAwake === "boolean" ? s.keepAwake : true,
      };
    }
    if (
      object(value.session) &&
      isTimer(value.session.timer) &&
      typeof value.session.elapsed === "number" &&
      Number.isFinite(value.session.elapsed) &&
      value.session.elapsed >= 0 &&
      (value.session.startedAt === null ||
        (typeof value.session.startedAt === "number" &&
          Number.isFinite(value.session.startedAt) &&
          value.session.startedAt > 0))
    )
      fallback.session = value.session as unknown as Session;
    return fallback;
  } catch {
    return fallback;
  }
}
export function loadStore(): Store {
  try {
    return parseStore(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStore();
  }
}
export function persistStore(store: Store): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
