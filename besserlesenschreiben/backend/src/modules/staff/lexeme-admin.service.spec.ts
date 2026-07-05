import { describe, it, expect, vi } from 'vitest';
import { LexemeAdminService } from './lexeme-admin.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';
import type { LexemeCreateInput } from './staff.dto';

const config = { get: () => 'test' } as unknown as ConfigService<Env, true>;

function make(prisma: Partial<Record<string, unknown>>) {
  const lexeme = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), ...prisma };
  return { svc: new LexemeAdminService({ lexeme } as unknown as PrismaService, config), lexeme };
}

const newWord: LexemeCreateInput = {
  lemma: 'Zebra', hk: 10, pos: 'N', genus: 'das', morphemeCount: 1, ipa: 'x', syllabification: 'ze-bra',
  syllableCount: 2, forms: null, separablePrefix: null, ageBand: null, familyStem: null, compoundParts: [],
  features: {}, skillTags: ['vowel_length'],
  isLernwort: false, isTrennbar: false, isMerkwort: false,
};

describe('LexemeAdminService', () => {
  it('add rejects unknown skill tags (400)', async () => {
    const { svc } = make({});
    await expect(svc.add({ ...newWord, skillTags: ['not_a_real_tag'] })).rejects.toMatchObject({
      constructor: ApiException,
      status: 400,
    });
  });

  it('add rejects a duplicate lemma (409)', async () => {
    const { svc, lexeme } = make({ findUnique: vi.fn().mockResolvedValue({ lemma: 'Zebra' }) });
    await expect(svc.add(newWord)).rejects.toMatchObject({ status: 409 });
    expect(lexeme.create).not.toHaveBeenCalled();
  });

  it('add creates with source="reviewer"', async () => {
    const { svc, lexeme } = make({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => ({ ...data, features: data.features })),
    });
    const res = await svc.add(newWord);
    expect(lexeme.create).toHaveBeenCalledWith({ data: expect.objectContaining({ source: 'reviewer', lemma: 'Zebra' }) });
    expect(res.source).toBe('reviewer');
  });

  it('edit rejects unknown skill tags before writing', async () => {
    const { svc, lexeme } = make({ findUnique: vi.fn().mockResolvedValue({ lemma: 'Wasser' }) });
    await expect(svc.edit('Wasser', { skillTags: ['bogus'] })).rejects.toMatchObject({ status: 400 });
    expect(lexeme.update).not.toHaveBeenCalled();
  });

  it('edit 404s for a missing lemma', async () => {
    const { svc } = make({ findUnique: vi.fn().mockResolvedValue(null) });
    await expect(svc.edit('Nope', { hk: 5 })).rejects.toMatchObject({ status: 404 });
  });
});
