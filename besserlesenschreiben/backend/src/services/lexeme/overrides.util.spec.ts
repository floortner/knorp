import { describe, it, expect } from 'vitest';
import { computeOverrides, type LexemeRecord } from './overrides.util';

function rec(lemma: string, over: Partial<LexemeRecord> = {}): LexemeRecord {
  return {
    lemma, hk: 9, pos: 'N', genus: null, morphemeCount: 1, ipa: 'x', syllabification: lemma,
    syllableCount: 1, forms: null, separablePrefix: null, familyStem: null, compoundParts: [],
    features: {}, skillTags: [],
    isLernwort: false, isTrennbar: false, isMerkwort: false, source: 'rwe2015', ...over,
  };
}

const base: LexemeRecord[] = [
  rec('Wasser', { genus: 'das', skillTags: ['double_consonant', 'vowel_length'] }),
  rec('viel', { skillTags: ['vowel_length'] }),
];

describe('computeOverrides (base⊕override diff)', () => {
  it('is empty when the DB equals the base', () => {
    expect(computeOverrides(base, base)).toEqual({ edits: {}, adds: [], deletes: [] });
  });

  it('captures only changed fields (field-level), adds, and deletes', () => {
    const db = [
      rec('Wasser', { genus: 'der', skillTags: ['double_consonant', 'vowel_length'] }), // genus edited
      rec('Zebra', { source: 'reviewer' }), // added (not in base)
      // viel deleted (absent from db)
    ];
    const o = computeOverrides(base, db);
    expect(o.edits).toEqual({ Wasser: { genus: 'der' } }); // only the changed field
    expect(o.adds.map((a) => a.lemma)).toEqual(['Zebra']);
    expect(o.adds[0].source).toBe('reviewer');
    expect(o.deletes).toEqual(['viel']);
  });

  it('ignores skillTag reorder and jsonb key order (no false diff)', () => {
    const db = [
      rec('Wasser', { genus: 'das', skillTags: ['vowel_length', 'double_consonant'], features: { b: true, a: '1' } }),
      rec('viel', { skillTags: ['vowel_length'] }),
    ];
    const baseWithFeatures = [
      rec('Wasser', { genus: 'das', skillTags: ['double_consonant', 'vowel_length'], features: { a: '1', b: true } }),
      rec('viel', { skillTags: ['vowel_length'] }),
    ];
    expect(computeOverrides(baseWithFeatures, db).edits).toEqual({});
  });
});
