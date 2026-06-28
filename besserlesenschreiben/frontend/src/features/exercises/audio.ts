import type { Exercise } from '@/lib/types';

/**
 * Voice + feedback sounds (SPEC §5). Plays a pre-generated `audioUrl` when present, else falls back to
 * the Web Speech API (de-DE, slower rate). All audio is gated on `soundOn` and guarded so it no-ops in
 * tests / unsupported environments. Must be triggered by a user gesture (mobile autoplay rules).
 */

function wordOf(ex: Exercise): string {
  if (ex.type === 'pairs') return ex.tiles.join(', ');
  if (ex.type === 'bd') return ex.glyph;
  return ex.word;
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
