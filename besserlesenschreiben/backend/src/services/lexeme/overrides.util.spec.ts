import { describe, it, expect } from 'vitest';
import { computeOverrides, type LexemeRecord } from './overrides.util';

function rec(lemma: string, over: Partial<LexemeRecord> = {}): LexemeRecord {
  return {
    lemma, hk: 9, pos: 'N', genus: null, morphemeCount: 1, ipa: 'x', syllabification: lemma,
    syllableCount: 1, forms: null, separablePrefix: null, ageBand: null, familyStem: null, compoundParts: [],
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

  it('treats empty compoundParts as equal to a missing/null base value (no spurious edit)', () => {
    // A base row from before the field existed → the key is absent (canonicalizes to null);
    // the DB row carries the schema default []. These must NOT diff.
    const baseNoField = [{ ...rec('Wasser'), compoundParts: undefined as unknown as string[] }];
    const db = [rec('Wasser', { compoundParts: [] })];
    expect(computeOverrides(baseNoField, db).edits).toEqual({});
  });

  it('captures changed familyStem and order-significant compoundParts', () => {
    const base = [rec('Holztreppe', { familyStem: null, compoundParts: [] })];
    const db = [rec('Holztreppe', { familyStem: 'treppe', compoundParts: ['Holz', 'Treppe'] })];
    expect(computeOverrides(base, db).edits).toEqual({
      Holztreppe: { familyStem: 'treppe', compoundParts: ['Holz', 'Treppe'] },
    });
    // order matters (unlike skillTags): a reordering is a real change
    const reordered = [rec('Holztreppe', { familyStem: 'treppe', compoundParts: ['Treppe', 'Holz'] })];
    expect(computeOverrides(db, reordered).edits).toEqual({
      Holztreppe: { compoundParts: ['Treppe', 'Holz'] },
    });
  });
});
