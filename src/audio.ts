import type { Transition } from "./engine";
import type { Settings, Sound } from "./storage";
export class TimerAudio {
  private context: AudioContext | null = null;
  private tones: OscillatorNode[] = [];
  private media: HTMLAudioElement | null = null;
  private preview: HTMLAudioElement | null = null;
  onError: (() => void) | null = null;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => this.onError?.());
  }
  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    endFrequency?: number,
  ) {
    const ctx = this.context;
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        start + duration,
      );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * 0.3, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    this.tones.push(oscillator);
    oscillator.onended = () => {
      this.tones = this.tones.filter((t) => t !== oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  transition(sound: Transition, settings: Settings) {
    this.stopTones();
    if (settings.muted || !settings.volume || sound === "none") return;
    const now = this.context?.currentTime;
    if (now === undefined) return;
    const v = settings.volume;
    if (sound === "beeps")
      [0, 1.15, 2.3].forEach((delay) => this.tone(880, now + delay, 0.15, v));
    if (sound === "bell") {
      this.tone(660, now, 1.2, v);
      this.tone(1320, now, 0.6, v * 0.4);
    }
    if (sound === "chime")
      [523.25, 659.25, 783.99].forEach((f, i) =>
        this.tone(f, now + i * 0.18, 0.7, v),
      );
    if (sound === "rise") this.tone(330, now, 0.6, v, "sine", 990);
    if (sound === "click") this.tone(1200, now, 0.05, v, "triangle");
  }
  interval(sound: Sound | undefined, settings: Settings, offset = 0) {
    this.stopMedia();
    if (!sound || settings.muted || !settings.volume) return;
    const media = new Audio(sound.data);
    this.media = media;
    media.loop = true;
    media.volume = settings.volume;
    media.onloadedmetadata = () => {
      if (Number.isFinite(media.duration) && media.duration > 0)
        media.currentTime = (offset / 1000) % media.duration;
    };
    void media.play().catch(() => this.onError?.());
  }
  previewSound(sound: Sound, settings: Settings) {
    this.stopPreview();
    this.preview = new Audio(sound.data);
    this.preview.volume = settings.muted ? 0 : settings.volume;
    void this.preview.play().catch(() => this.onError?.());
  }
  stopPreview() {
    this.preview?.pause();
    this.preview = null;
  }
  stopTones() {
    for (const tone of this.tones) {
      try {
        tone.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.tones = [];
  }
  stopMedia() {
    this.media?.pause();
    this.media = null;
  }
  stop() {
    this.stopTones();
    this.stopMedia();
    this.stopPreview();
  }
}
