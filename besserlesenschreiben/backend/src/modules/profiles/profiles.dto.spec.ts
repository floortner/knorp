import { describe, expect, it } from 'vitest';
import { updateSettingsSchema } from './profiles.dto';

describe('updateSettingsSchema', () => {
  it('accepts a valid appearance value', () => {
    expect(updateSettingsSchema.safeParse({ appearance: 'dark' }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ appearance: 'auto' }).success).toBe(true);
  });

  it('rejects an unknown appearance value', () => {
    expect(updateSettingsSchema.safeParse({ appearance: 'blue' }).success).toBe(false);
  });

  it('keeps appearance optional (partial PATCH)', () => {
    expect(updateSettingsSchema.safeParse({ soundOn: false }).success).toBe(true);
  });
});
