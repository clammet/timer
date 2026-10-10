import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Copy,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Home,
  Minus,
  Moon,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Save,
  Settings2,
  SkipForward,
  Square,
  Timer as TimerIcon,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  colors,
  elapsedAt,
  formatTime,
  iconNames,
  interval,
  positionAt,
  transitionCueAt,
  preset,
  roundDuration,
  totalDuration,
  transitions,
  uid,
  type IconName,
  type Interval,
  type Round,
  type Timer,
} from "./engine";
import { loadStore, persistStore, type Sound, type Store } from "./storage";
import { TimerAudio } from "./audio";

const icons = {
  zap: Zap,
  dumbbell: Dumbbell,
  coffee: Coffee,
  heart: Heart,
  wind: Wind,
  flame: Flame,
  timer: TimerIcon,
  footprints: Footprints,
  moon: Moon,
  music: Music,
};
const soundLabels = {
  none: "None",
  beeps: "Beeps",
  "loud-beep": "Loud Beep",
  bell: "Bell",
  chime: "Chime",
  rise: "Rise",
  click: "Click",
};
function Glyph({ name, size = 24 }: { name: IconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.8} />;
}
function intervalPanelStyle(color: string): CSSProperties {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const background = luminance(color);
  const dark = "#141918";
  const darkContrast = (background + 0.05) / (luminance(dark) + 0.05);
  const lightContrast = 1.05 / (background + 0.05);
  return {
    backgroundColor: color,
    color: darkContrast >= lightContrast ? dark : "#ffffff",
  };
}
function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function NumberField({
  label,
  value,
  min = 1,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Math.max(min, Math.min(max, Math.floor(Number(draft) || min)));
    setDraft(String(next));
    onChange(next);
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <IconButton
          label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus size={16} />
        </IconButton>
        <input
          aria-label={label}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <IconButton
          label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus size={16} />
        </IconButton>
      </div>
    </label>
  );
}
const initialStore = () => {
  const data = loadStore();
  if (data.session)
    data.session = {
      ...data.session,
      elapsed: elapsedAt(data.session),
      startedAt: null,
    };
  return data;
};
export default function App() {
  const [store, setStore] = useState(initialStore);
  const storeRef = useRef(store);
  const [page, setPage] = useState<"home" | "timer" | "settings">(() =>
    store.session ? "timer" : "home",
  );
  const [editor, setEditor] = useState<Timer | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{
    label: string;
    action: () => void;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const audio = useRef(new TimerAudio()).current;
  const fileInput = useRef<HTMLInputElement>(null);
  const session = store.session;
  const elapsed = session ? elapsedAt(session, now) : 0;
  const current = session ? positionAt(session.timer, elapsed) : null;
  const next =
    session && current ? positionAt(session.timer, current.end) : null;
  const running = session?.startedAt !== null && !!session;
  const complete = !!session && !current;
  function update(patch: Partial<Store>) {
    const value = { ...storeRef.current, ...patch };
    if (!persistStore(value)) {
      setNotice("Storage full · Unsaved");
      return false;
    }
    storeRef.current = value;
    setStore(value);
    return true;
  }
  useEffect(() => {
    persistStore(storeRef.current);
  }, []);
  useEffect(() => {
    audio.onError = () => setNotice("Audio unavailable");
    return () => audio.stop();
  }, [audio]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    const visible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [running]);
  useEffect(() => {
    if (running && complete && session) {
      audio.stop();
      update({
        session: {
          ...session,
          elapsed: totalDuration(session.timer),
          startedAt: null,
        },
      });
    }
  }, [complete, running]); // Completion is persisted once, rather than on each tick.
  useEffect(() => {
    if (!running || !session || !current || store.settings.muted) {
      audio.stopMedia();
      audio.stopTones();
      return;
    }
    const actualElapsed = elapsedAt(session);
    const cue = transitionCueAt(session.timer, actualElapsed);
    audio.transition(cue?.sound ?? "none", store.settings, cue?.remaining);
    audio.interval(
      store.sounds.find((s) => s.id === current.interval.sound),
      store.settings,
      actualElapsed - current.start,
    );
    return () => {
      audio.stopMedia();
      audio.stopTones();
    };
  }, [
    running,
    current?.key,
    session?.startedAt,
    store.settings.volume,
    store.settings.muted,
    store.sounds,
    audio,
  ]);
  useEffect(() => {
    if (!running || !store.settings.keepAwake || !("wakeLock" in navigator))
      return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    async function request() {
      try {
        if (document.visibilityState !== "visible") return;
        const acquired = await navigator.wakeLock.request("screen");
        if (cancelled) await acquired.release();
        else lock = acquired;
      } catch {
        /* Unsupported or denied by the device. */
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released))
        void request();
    };
    void request();
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visible);
      void lock?.release();
    };
  }, [running, store.settings.keepAwake]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmation(null);
      if (event.key !== "Tab") return;
      const buttons =
        document.querySelectorAll<HTMLButtonElement>(".modal button");
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [confirmation]);
  function navigate(nextPage: typeof page) {
    audio.stopPreview();
    setEditor(null);
    setPage(nextPage);
    window.scrollTo(0, 0);
  }
  function openEditor(timer: Timer) {
    audio.stopPreview();
    setEditor(structuredClone(timer));
    setExpanded(null);
    window.scrollTo(0, 0);
  }
  function save(timer: Timer) {
    const clean = {
      ...timer,
      name: timer.name.trim() || "Timer",
      rounds: timer.rounds.map((r, i) => ({
        ...r,
        name: r.name.trim() || `Round ${i + 1}`,
        intervals: r.intervals.map((item) => ({
          ...item,
          name: item.name.trim() || "Interval",
        })),
      })),
    };
    const timers = storeRef.current.timers;
    if (
      update({
        timers: timers.some((t) => t.id === clean.id)
          ? timers.map((t) => (t.id === clean.id ? clean : t))
          : [...timers, clean],
      })
    ) {
      setEditor(null);
      setPage("home");
      window.scrollTo(0, 0);
      setNotice("Saved");
    }
  }
  function activate(timer: Timer) {
    const start = () => {
      audio.unlock();
      audio.stop();
      const timestamp = Date.now();
      setNow(timestamp);
      if (
        update({
          session: {
            timer: structuredClone(timer),
            elapsed: 0,
            startedAt: timestamp,
          },
        })
      ) {
        setNotice("");
        setEditor(null);
        setPage("timer");
        window.scrollTo(0, 0);
      }
    };
    if (
      storeRef.current.session &&
      elapsedAt(storeRef.current.session) <
        totalDuration(storeRef.current.session.timer)
    )
      setConfirmation({ label: "Replace active timer?", action: start });
    else start();
  }
  function toggleRunning() {
    if (!session) return;
    audio.unlock();
    const timestamp = Date.now();
    setNow(timestamp);
    update({
      session: {
        ...session,
        elapsed: complete ? 0 : elapsedAt(session, timestamp),
        startedAt: running ? null : timestamp,
      },
    });
  }
  function restart() {
    if (!session) return;
    audio.unlock();
    audio.stop();
    setNow(Date.now());
    update({
      session: {
        ...session,
        elapsed: 0,
        startedAt: running ? Date.now() : null,
      },
    });
  }
  function skip() {
    if (session && current) {
      audio.unlock();
      setNow(Date.now());
      update({
        session: {
          ...session,
          elapsed: current.end,
          startedAt: running ? Date.now() : null,
        },
      });
    }
  }
  function setRound(id: string, patch: Partial<Round>) {
    if (editor)
      setEditor({
        ...editor,
        rounds: editor.rounds.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      });
  }
  function setIntervalItem(round: Round, id: string, patch: Partial<Interval>) {
    setRound(round.id, {
      intervals: round.intervals.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!(
      file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      file.type === "application/ogg"
    )) {
      setNotice("Audio files only");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("2 MB maximum");
      return;
    }
    setUploading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const playable = new Audio(data);
      await new Promise<void>((resolve, reject) => {
        playable.onloadedmetadata = () => resolve();
        playable.onerror = reject;
        playable.load();
      });
      const sound: Sound = {
        id: uid(),
        name: file.name.replace(/\.[^.]+$/, ""),
        data,
      };
      if (update({ sounds: [...storeRef.current.sounds, sound] }))
        setNotice("Sound added");
    } catch {
      setNotice("Unsupported audio");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function deleteSound(id: string) {
    audio.stopPreview();
    const data = storeRef.current;
    const removeReference = (timer: Timer): Timer => ({
      ...timer,
      rounds: timer.rounds.map((r) => ({
        ...r,
        intervals: r.intervals.map((i) =>
          i.sound === id ? { ...i, sound: null } : i,
        ),
      })),
    });
    update({
      sounds: data.sounds.filter((s) => s.id !== id),
      timers: data.timers.map(removeReference),
      session: data.session
        ? { ...data.session, timer: removeReference(data.session.timer) }
        : null,
    });
  }
  const total = session ? totalDuration(session.timer) : 0;
  return (
    <div className={`app ${page === "timer" && !editor ? "player-app" : ""}`}>
      {!(page === "timer" && !editor) && (
        <header className="brand-header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
          >
            <span className="brand-mark">
              <TimerIcon size={25} />
            </span>
            tempo<span className="brand-dot">.</span>
          </a>
        </header>
      )}
      {editor ? (
        <main className="editor page">
          <div className="page-heading">
            <div className="heading-with-back">
              <IconButton
                label="Close editor"
                onClick={() => {
                  setEditor(null);
                  audio.stopPreview();
                }}
              >
                <ArrowLeft />
              </IconButton>
              <div>
                <h1>
                  {store.timers.some((t) => t.id === editor.id)
                    ? "Edit timer"
                    : "New timer"}
                </h1>
              </div>
            </div>
            <button
              className="button primary compact"
              onClick={() => save(editor)}
            >
              <Save size={20} />
              <span>Save</span>
            </button>
          </div>
          <section className="timer-details surface">
            <label className="text-field">
              <span>Name</span>
              <input
                maxLength={60}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            <NumberField
              label="Cycles"
              value={editor.cycles}
              onChange={(cycles) => setEditor({ ...editor, cycles })}
            />
            <div className="total-label">
              <TimerIcon size={18} />
              {formatTime(totalDuration(editor))}
              <span>Total</span>
            </div>
          </section>
          {editor.rounds.map((round, ri) => (
            <section className="round surface" key={round.id}>
              <div className="round-heading">
                <span className="round-number">
                  {String(ri + 1).padStart(2, "0")}
                </span>
                <input
                  className="round-name"
                  aria-label={`Round ${ri + 1} name`}
                  maxLength={60}
                  value={round.name}
                  onChange={(e) => setRound(round.id, { name: e.target.value })}
                />
                <div className="round-actions">
                  <IconButton
                    label="Move round up"
                    disabled={ri === 0}
                    onClick={() => {
                      const rounds = [...editor.rounds];
                      [rounds[ri - 1], rounds[ri]] = [
                        rounds[ri],
                        rounds[ri - 1],
                      ];
                      setEditor({ ...editor, rounds });
                    }}
                  >
                    <ArrowUp size={18} />
                  </IconButton>
                  <IconButton
                    label="Move round down"
                    disabled={ri === editor.rounds.length - 1}
                    onClick={() => {
                      const rounds = [...editor.rounds];
                      [rounds[ri + 1], rounds[ri]] = [
                        rounds[ri],
                        rounds[ri + 1],
                      ];
                      setEditor({ ...editor, rounds });
                    }}
                  >
                    <ArrowDown size={18} />
                  </IconButton>
                  <IconButton
                    label="Delete round"
                    disabled={editor.rounds.length === 1}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        rounds: editor.rounds.filter((r) => r.id !== round.id),
                      })
                    }
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="repeat-line">
                <NumberField
                  label="Repeat"
                  value={round.repeat}
                  onChange={(repeat) => setRound(round.id, { repeat })}
                />
                <span className="muted">
                  {formatTime(roundDuration(round) * round.repeat)}
                </span>
              </div>
              <div className="interval-list">
                {round.intervals.map((item, ii) => (
                  <div
                    className={`interval-editor ${expanded === item.id ? "expanded" : ""}`}
                    key={item.id}
                    style={{ "--interval-color": item.color } as CSSProperties}
                  >
                    <button
                      className="interval-summary"
                      aria-expanded={expanded === item.id}
                      onClick={() =>
                        setExpanded(expanded === item.id ? null : item.id)
                      }
                    >
                      <span className="interval-glyph">
                        <Glyph name={item.icon} />
                      </span>
                      <span className="interval-summary-name">{item.name}</span>
                      <span className="mono">
                        {formatTime(item.duration * 1000)}
                      </span>
                      <ChevronDown size={20} />
                    </button>
                    {expanded === item.id && (
                      <div className="interval-fields">
                        <label className="text-field">
                          <span>Name</span>
                          <input
                            maxLength={60}
                            value={item.name}
                            onChange={(e) =>
                              setIntervalItem(round, item.id, {
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="duration-fields">
                          <NumberField
                            label="Minutes"
                            min={0}
                            max={1439}
                            value={Math.floor(item.duration / 60)}
                            onChange={(m) =>
                              setIntervalItem(round, item.id, {
                                duration: Math.max(
                                  1,
                                  m * 60 + (item.duration % 60),
                                ),
                              })
                            }
                          />
                          <NumberField
                            label="Seconds"
                            min={0}
                            max={59}
                            value={item.duration % 60}
                            onChange={(s) =>
                              setIntervalItem(round, item.id, {
                                duration: Math.max(
                                  1,
                                  Math.floor(item.duration / 60) * 60 + s,
                                ),
                              })
                            }
                          />
                        </div>
                        <fieldset>
                          <legend>Colour</legend>
                          <div className="colour-picker">
                            {colors.map((color) => (
                              <button
                                key={color}
                                aria-label={`Colour ${color}`}
                                aria-pressed={item.color === color}
                                className="swatch"
                                style={{ background: color }}
                                onClick={() =>
                                  setIntervalItem(round, item.id, { color })
                                }
                              >
                                {item.color === color && <Check size={20} />}
                              </button>
                            ))}
                            <label
                              className="custom-colour"
                              title="Custom colour"
                            >
                              <Plus size={20} />
                              <input
                                type="color"
                                aria-label="Custom colour"
                                value={item.color}
                                onChange={(e) =>
                                  setIntervalItem(round, item.id, {
                                    color: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        </fieldset>
                        <fieldset>
                          <legend>Icon</legend>
                          <div className="icon-picker">
                            {iconNames.map((name) => (
                              <button
                                key={name}
                                aria-label={`Icon ${name}`}
                                aria-pressed={item.icon === name}
                                className={item.icon === name ? "selected" : ""}
                                onClick={() =>
                                  setIntervalItem(round, item.id, {
                                    icon: name,
                                  })
                                }
                              >
                                <Glyph name={name} />
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <div className="sound-fields">
                          <label className="select-field">
                            <span>
                              <Music size={16} />
                              Interval sound
                            </span>
                            <select
                              aria-label="Interval sound"
                              value={item.sound ?? ""}
                              onChange={(e) =>
                                setIntervalItem(round, item.id, {
                                  sound: e.target.value || null,
                                })
                              }
                            >
                              <option value="">None</option>
                              {store.sounds.map((sound) => (
                                <option key={sound.id} value={sound.id}>
                                  {sound.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="select-field">
                            <span>
                              <Bell size={16} />
                              Transition
                            </span>
                            <div className="select-preview">
                              <select
                                aria-label="Transition"
                                value={item.transition}
                                onChange={(e) =>
                                  setIntervalItem(round, item.id, {
                                    transition: e.target
                                      .value as Interval["transition"],
                                  })
                                }
                              >
                                {transitions.map((t) => (
                                  <option key={t} value={t}>
                                    {soundLabels[t]}
                                  </option>
                                ))}
                              </select>
                              <IconButton
                                label="Preview transition"
                                onClick={() => {
                                  audio.unlock();
                                  audio.previewTransition(
                                    item.transition,
                                    store.settings,
                                  );
                                }}
                              >
                                <Play size={18} />
                              </IconButton>
                            </div>
                          </label>
                        </div>
                        <div className="interval-actions">
                          <IconButton
                            label="Move interval up"
                            disabled={ii === 0}
                            onClick={() => {
                              const items = [...round.intervals];
                              [items[ii - 1], items[ii]] = [
                                items[ii],
                                items[ii - 1],
                              ];
                              setRound(round.id, { intervals: items });
                            }}
                          >
                            <ArrowUp size={18} />
                          </IconButton>
                          <IconButton
                            label="Move interval down"
                            disabled={ii === round.intervals.length - 1}
                            onClick={() => {
                              const items = [...round.intervals];
                              [items[ii + 1], items[ii]] = [
                                items[ii],
                                items[ii + 1],
                              ];
                              setRound(round.id, { intervals: items });
                            }}
                          >
                            <ArrowDown size={18} />
                          </IconButton>
                          <IconButton
                            label="Duplicate interval"
                            disabled={round.intervals.length >= 100}
                            onClick={() => {
                              const items = [...round.intervals];
                              items.splice(ii + 1, 0, { ...item, id: uid() });
                              setRound(round.id, { intervals: items });
                            }}
                          >
                            <Copy size={18} />
                          </IconButton>
                          <IconButton
                            label="Delete interval"
                            className="danger"
                            disabled={round.intervals.length === 1}
                            onClick={() =>
                              setRound(round.id, {
                                intervals: round.intervals.filter(
                                  (i) => i.id !== item.id,
                                ),
                              })
                            }
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="button dashed full"
                disabled={round.intervals.length >= 100}
                onClick={() => {
                  const item = interval();
                  setRound(round.id, { intervals: [...round.intervals, item] });
                  setExpanded(item.id);
                }}
              >
                <Plus size={20} />
                Interval
              </button>
            </section>
          ))}
          <button
            className="button secondary full"
            disabled={editor.rounds.length >= 100}
            onClick={() =>
              setEditor({
                ...editor,
                rounds: [
                  ...editor.rounds,
                  {
                    id: uid(),
                    name: `Round ${editor.rounds.length + 1}`,
                    repeat: 1,
                    intervals: [interval()],
                  },
                ],
              })
            }
          >
            <Plus size={20} />
            Round
          </button>
        </main>
      ) : page === "home" ? (
        <main className="home page">
          <div className="page-heading home-heading">
            <div>
              <h1>Saved timers</h1>
            </div>
            <button
              className="button primary new-timer"
              aria-label="New timer"
              onClick={() => openEditor(preset("Custom"))}
            >
              <Plus size={22} />
              <span>New timer</span>
            </button>
          </div>
          {store.timers.length ? (
            <div className="saved-timers">
              {store.timers.map((timer) => (
                <article className="saved-card surface" key={timer.id}>
                  <div className="saved-card-top">
                    <span
                      className="saved-symbol"
                      style={{
                        background: `${timer.rounds[0].intervals[0].color}22`,
                        color: timer.rounds[0].intervals[0].color,
                      }}
                    >
                      <Glyph
                        name={timer.rounds[0].intervals[0].icon}
                        size={25}
                      />
                    </span>
                    <div className="card-tools">
                      <IconButton
                        label={`Edit ${timer.name}`}
                        onClick={() => openEditor(timer)}
                      >
                        <Pencil size={19} />
                      </IconButton>
                      <IconButton
                        label={`Duplicate ${timer.name}`}
                        onClick={() => {
                          const clone = structuredClone(timer);
                          clone.id = uid();
                          clone.name = `${timer.name} copy`;
                          openEditor(clone);
                        }}
                      >
                        <Copy size={19} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${timer.name}`}
                        onClick={() =>
                          setConfirmation({
                            label: `Delete ${timer.name}?`,
                            action: () =>
                              update({
                                timers: storeRef.current.timers.filter(
                                  (t) => t.id !== timer.id,
                                ),
                              }),
                          })
                        }
                      >
                        <Trash2 size={19} />
                      </IconButton>
                    </div>
                  </div>
                  <h3>{timer.name}</h3>
                  <div className="timer-meta">
                    <span>
                      <TimerIcon size={16} />
                      {formatTime(totalDuration(timer))}
                    </span>
                    <span>
                      <Repeat2 size={16} />
                      {timer.cycles} {timer.cycles === 1 ? "cycle" : "cycles"}
                    </span>
                    <span>
                      {timer.rounds.length}{" "}
                      {timer.rounds.length === 1 ? "round" : "rounds"}
                    </span>
                  </div>
                  <div className="card-bottom">
                    <div className="interval-dots">
                      {timer.rounds
                        .flatMap((r) => r.intervals)
                        .slice(0, 8)
                        .map((item, i) => (
                          <span
                            key={`${item.id}-${i}`}
                            style={{ background: item.color }}
                            title={item.name}
                          />
                        ))}
                    </div>
                    <button
                      className="button start-button"
                      onClick={() => activate(timer)}
                    >
                      <Play size={18} fill="currentColor" />
                      Start
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <button
              className="empty-state"
              onClick={() => openEditor(preset("Custom"))}
            >
              <span className="empty-icon">
                <TimerIcon size={36} strokeWidth={1.4} />
                <Plus size={16} />
              </span>
              <strong>New timer</strong>
            </button>
          )}
          <div className="section-heading create-heading">
            <h2>Create new</h2>
          </div>
          <div className="presets">
            {(["Tabata", "Rounds"] as const).map((name, i) => (
              <button
                className={`preset-card preset-${i}`}
                key={name}
                onClick={() => openEditor(preset(name))}
              >
                <span className="preset-top">
                  <span className="preset-symbol">
                    {i === 0 ? <Zap size={27} /> : <Repeat2 size={27} />}
                  </span>
                  <ArrowRight size={23} />
                </span>
                <span className="preset-name">{name}</span>
                <span className="preset-meta">
                  {i === 0 ? "10 repeats" : "1 repeat"}
                  <span>·</span>
                  {formatTime(totalDuration(preset(name)))}
                </span>
                <span className="preset-bars">
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            ))}
          </div>
        </main>
      ) : page === "timer" && session ? (
        <main
          className="player"
          style={
            {
              "--active-color": current?.interval.color ?? colors[2],
            } as CSSProperties
          }
        >
          <div className="player-header">
            <IconButton label="Home" onClick={() => navigate("home")}>
              <ArrowLeft size={23} />
            </IconButton>
            <div>
              <span className="player-timer-name">{session.timer.name}</span>
              <div className="overall-time">
                {formatTime(total - elapsed)} <span>({formatTime(total)})</span>
              </div>
            </div>
            <IconButton
              label={store.settings.muted ? "Unmute" : "Mute"}
              onClick={() => {
                audio.unlock();
                update({
                  settings: { ...store.settings, muted: !store.settings.muted },
                });
              }}
            >
              {store.settings.muted ? (
                <VolumeX size={22} />
              ) : (
                <Volume2 size={22} />
              )}
            </IconButton>
          </div>
          <div className="overall-progress">
            <span style={{ width: `${(elapsed / total) * 100}%` }} />
          </div>
          <section
            className="current-interval"
            aria-label="Current interval"
            style={intervalPanelStyle(current?.interval.color ?? colors[2])}
          >
            <div className="current-heading">
              <span className="current-icon">
                {current ? (
                  <Glyph name={current.interval.icon} size={36} />
                ) : (
                  <Check size={36} />
                )}
              </span>
              <h1>{current?.interval.name ?? "Complete"}</h1>
            </div>
            <div
              className="countdown"
              style={{
                fontSize: `clamp(28px, ${95 / formatTime(current?.remaining ?? 0).length}vw, ${550 / formatTime(current?.remaining ?? 0).length}px)`,
              }}
              role="timer"
              aria-label="Interval remaining"
            >
              {formatTime(current?.remaining ?? 0)}
            </div>
          </section>
          <section
            className="next-interval"
            aria-label="Next interval"
            style={next ? intervalPanelStyle(next.interval.color) : undefined}
          >
            {next ? (
              <div className="next-content">
                <span className="next-icon">
                  <Glyph name={next.interval.icon} size={28} />
                </span>
                <div>
                  <h2>{next.interval.name}</h2>
                </div>
                <span className="next-time">
                  {formatTime(next.interval.duration * 1000)}
                </span>
                <ChevronRight size={20} />
              </div>
            ) : (
              <div className="next-content">
                <span className="next-icon">
                  <Check size={27} />
                </span>
                <h2>{complete ? "Finished" : "Finish"}</h2>
                <span className="next-time">00:00</span>
              </div>
            )}
          </section>
          <div className="player-controls">
            <IconButton
              label="Restart timer"
              onClick={() =>
                setConfirmation({ label: "Restart timer?", action: restart })
              }
            >
              <RotateCcw size={25} />
            </IconButton>
            <button
              className="play-toggle"
              aria-label={
                complete
                  ? "Replay timer"
                  : running
                    ? "Pause timer"
                    : "Resume timer"
              }
              onClick={toggleRunning}
            >
              {complete ? (
                <RotateCcw size={32} />
              ) : running ? (
                <Pause size={32} fill="currentColor" />
              ) : (
                <Play size={32} fill="currentColor" />
              )}
            </button>
            <IconButton
              label="Next interval"
              disabled={!current}
              onClick={skip}
            >
              <SkipForward size={25} />
            </IconButton>
            <IconButton
              label="Stop timer"
              onClick={() =>
                setConfirmation({
                  label: "Stop timer?",
                  action: () => {
                    if (update({ session: null })) {
                      audio.stop();
                      setPage("home");
                    }
                  },
                })
              }
            >
              <Square size={23} />
            </IconButton>
          </div>
        </main>
      ) : page === "settings" ? (
        <main className="settings page">
          <div className="page-heading">
            <div>
              <h1>
                Settings<span className="accent">.</span>
              </h1>
            </div>
          </div>
          <section className="surface settings-panel">
            <h2>Playback</h2>
            <div className="setting-row">
              <span>
                <Volume2 size={21} />
                Sound
              </span>
              <button
                role="switch"
                aria-checked={!store.settings.muted}
                aria-label="Sound"
                className={`switch ${!store.settings.muted ? "on" : ""}`}
                onClick={() => {
                  audio.unlock();
                  update({
                    settings: {
                      ...store.settings,
                      muted: !store.settings.muted,
                    },
                  });
                }}
              >
                <span />
              </button>
            </div>
            <label className="volume-field">
              <span>
                Volume <b>{Math.round(store.settings.volume * 100)}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={store.settings.volume}
                onChange={(e) =>
                  update({
                    settings: {
                      ...store.settings,
                      volume: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <div className="setting-row">
              <span>
                <TimerIcon size={21} />
                Keep screen awake
              </span>
              <button
                role="switch"
                aria-checked={store.settings.keepAwake}
                aria-label="Keep screen awake"
                className={`switch ${store.settings.keepAwake ? "on" : ""}`}
                onClick={() =>
                  update({
                    settings: {
                      ...store.settings,
                      keepAwake: !store.settings.keepAwake,
                    },
                  })
                }
              >
                <span />
              </button>
            </div>
          </section>
          <section className="surface settings-panel">
            <div className="section-heading">
              <h2>Custom sounds</h2>
              <button
                className="button secondary compact"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={19} />
                {uploading ? "Loading" : "Add"}
              </button>
            </div>
            <span className="micro-label">AUDIO · 2 MB MAX / FILE</span>
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,video/mp4,video/webm,application/ogg"
              hidden
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            {store.sounds.length ? (
              <div className="sound-list">
                {store.sounds.map((sound) => (
                  <div className="sound-row" key={sound.id}>
                    <span className="sound-icon">
                      <Music size={20} />
                    </span>
                    <span>{sound.name}</span>
                    <IconButton
                      label={`Play ${sound.name}`}
                      onClick={() => audio.previewSound(sound, store.settings)}
                    >
                      <Play size={19} />
                    </IconButton>
                    <IconButton
                      label={`Stop ${sound.name}`}
                      onClick={() => audio.stopPreview()}
                    >
                      <Square size={17} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${sound.name}`}
                      onClick={() =>
                        setConfirmation({
                          label: `Delete ${sound.name}?`,
                          action: () => deleteSound(sound.id),
                        })
                      }
                    >
                      <Trash2 size={19} />
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sounds-empty">
                <Music size={32} strokeWidth={1.5} />
                <span>No custom sounds</span>
              </div>
            )}
          </section>
          <section className="surface settings-panel">
            <h2>Transition sounds</h2>
            <div className="transition-list">
              {transitions
                .filter((t) => t !== "none")
                .map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      audio.unlock();
                      audio.previewTransition(t, store.settings);
                    }}
                  >
                    <Bell size={18} />
                    <span>{soundLabels[t]}</span>
                    <Play size={17} />
                  </button>
                ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="page empty-state">
          <TimerIcon size={44} />
          <h1>No active timer</h1>
          <button className="button primary" onClick={() => navigate("home")}>
            Home
          </button>
        </main>
      )}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          className={page === "home" && !editor ? "active" : ""}
          onClick={() => navigate("home")}
        >
          <Home size={23} />
          <span>Home</span>
        </button>
        {session && (
          <button
            className={page === "timer" && !editor ? "active" : ""}
            onClick={() => navigate("timer")}
          >
            <span className="nav-timer-icon">
              <TimerIcon size={23} />
              {running && <i />}
            </span>
            <span className="nav-timer-name">{session.timer.name}</span>
          </button>
        )}
        <button
          className={page === "settings" && !editor ? "active" : ""}
          onClick={() => navigate("settings")}
        >
          <Settings2 size={23} />
          <span>Settings</span>
        </button>
      </nav>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <IconButton label="Dismiss" onClick={() => setNotice("")}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      {confirmation && (
        <div className="modal-backdrop" onClick={() => setConfirmation(null)}>
          <section
            className="modal surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirmation-title">{confirmation.label}</h2>
            <div>
              <button
                autoFocus
                className="button secondary"
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => {
                  const action = confirmation.action;
                  setConfirmation(null);
                  action();
                }}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
