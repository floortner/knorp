import type { Exercise } from '@/lib/types';

/**
 * Derive the telemetry `prompt` + `expected` for an exercise (frontend SPEC §4). Pure and total over
 * the union so the backend's NOT-NULL columns never receive undefined. `given` is supplied by the
 * renderer (the child's choice, stringified).
 */
export function promptAndExpected(ex: Exercise): { prompt: string; expected: string } {
  switch (ex.type) {
    case 'raster':
      return { prompt: ex.word, expected: [ex.onset, ex.vowel, ex.coda].join('|') };
    case 'findvowel':
      return { prompt: ex.word, expected: ex.answer };
    case 'realword':
      return { prompt: ex.word, expected: ex.answer };
    case 'fixvowel':
      return { prompt: `${ex.pseudo}→${ex.vowel}`, expected: ex.answer };
    case 'swapvowel':
      return { prompt: ex.word, expected: ex.answers.join('/') };
    case 'length':
      return { prompt: ex.word, expected: ex.answer };
    case 'sylvalid':
      return { prompt: ex.syllable, expected: ex.answer };
    case 'insertvowel':
      return { prompt: ex.pattern, expected: ex.answer };
    case 'paircheck':
      return { prompt: `${ex.left} ↔ ${ex.right}`, expected: ex.answer };
    case 'pickword':
      return { prompt: ex.options.join(' '), expected: ex.answer };
    case 'sentencefix':
      return { prompt: ex.tokens.join(' '), expected: ex.answer };
    case 'compound':
      return { prompt: ex.word, expected: ex.answer };
    case 'family':
      return { prompt: ex.stem, expected: ex.answer };
    case 'sylarrange':
      return { prompt: ex.word, expected: ex.syll.join('|') };
  }
}
