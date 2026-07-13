import type { Exercise } from '@/lib/types';

/**
 * Voice + feedback sounds (SPEC §5). Plays a pre-generated `audioUrl` when present, else falls back to
 * the Web Speech API (de-DE, slower rate). All audio is gated on `soundOn` and guarded so it no-ops in
 * tests / unsupported environments. Must be triggered by a user gesture (mobile autoplay rules).
 */

function wordOf(ex: Exercise): string {
  return ex.answer;
}

export function speak(ex: Exercise, soundOn: boolean): void {
  if (!soundOn) return;
  try {
    if (ex.audioUrl) {
      void new Audio(ex.audioUrl).play().catch(() => {});
      return;
    }
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(wordOf(ex));
    u.lang = 'de-DE';
    u.rate = 0.85;
    synth.cancel();
    synth.speak(u);
  } catch {
    /* audio is best-effort — never break the lesson */
  }
}

/** Short positive/negative cues via the Web Audio API (no asset files). */
export function chime(soundOn: boolean): void {
  beep(soundOn, 880, 0.12);
}
export function buzz(soundOn: boolean): void {
  beep(soundOn, 160, 0.18);
}

/** Ascending arpeggio fanfare for all-units-complete celebration. */
export function fanfare(soundOn: boolean): void {
  if (!soundOn) return;
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 1000);
  } catch {
    /* best-effort */
  }
}

function beep(soundOn: boolean, freq: number, durationS: number): void {
  if (!soundOn) return;
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationS);
    osc.onended = () => void ctx.close().catch(() => {});
  } catch {
    /* best-effort */
  }
}
