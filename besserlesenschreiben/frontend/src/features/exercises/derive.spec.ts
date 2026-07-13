import { describe, it, expect } from 'vitest';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { promptAndExpected } from './derive';

const items = (session as unknown as { items: Exercise[] }).items;

describe('promptAndExpected', () => {
  it('derives prompt + expected for the placeholder fixture', () => {
    expect(items).toHaveLength(1);
    expect(promptAndExpected(items[0])).toEqual({ prompt: 'Was passt?', expected: 'Apfel' });
  });
});
