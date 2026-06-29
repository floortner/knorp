import type { Exercise } from '@/lib/types';

/**
 * Derive the telemetry `prompt` + `expected` for an exercise (frontend SPEC §4). Pure and total over
 * the union so the backend's NOT-NULL columns never receive undefined. `given` is supplied by the
 * renderer (the child's choice, stringified).
 */
export function promptAndExpected(ex: Exercise): { prompt: string; expected: string } {
  switch (ex.type) {
    case 'order':
    case 'arrange':
      return { prompt: ex.word, expected: ex.syll.join('|') };
    case 'pairs':
      return { prompt: ex.tiles.join(' '), expected: ex.pair.join('+') };
    case 'bd':
      return { prompt: ex.glyph, expected: String(ex.answer) };
    case 'odd':
      return { prompt: ex.words.join(' '), expected: ex.answer };
    case 'sentence':
      return { prompt: ex.tokens.join(' '), expected: ex.answer };
    case 'build':
      return { prompt: ex.emoji, expected: ex.answer.join('') };
    default:
      // count | gap | rhyme | initial | letter | case | nonsense | vowel | swipe | listen
      return { prompt: ex.word, expected: String(ex.answer) };
  }
}
