import type { Exercise } from '@/lib/types';

/**
 * Derive the telemetry `prompt` + `expected` for an exercise (frontend SPEC §4). Pure and total over
 * the union so the backend's NOT-NULL columns never receive undefined. `given` is supplied by the
 * renderer (the child's choice, stringified).
 */
export function promptAndExpected(ex: Exercise): { prompt: string; expected: string } {
  switch (ex.type) {
    case 'placeholder':
      return { prompt: ex.prompt, expected: ex.answer };
  }
}
