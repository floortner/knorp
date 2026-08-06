import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import assigned from '../../../fixtures/session-assigned.example.json';
import { ExerciseView } from './ExerciseView';

/**
 * Golden snapshots for the Exercise rendering contract (AGENTS.md, CLAUDE.md): every item in the
 * committed golden fixtures renders to a pinned DOM tree. A snapshot diff means the client-facing
 * rendering of the contract changed — update intentionally, alongside the fixture/contract change.
 */

const noop = () => {};

const suites: Array<[string, { items: Exercise[] }]> = [
  ['session.example.json', session as unknown as { items: Exercise[] }],
  ['session-assigned.example.json', assigned as unknown as { items: Exercise[] }],
];

describe.each(suites)('golden rendering: %s', (_name, fixture) => {
  it.each(fixture.items.map((ex) => [ex.id, ex] as const))('renders %s', (_id, ex) => {
    const { asFragment } = render(<ExerciseView ex={ex} onAttempt={noop} onSolved={noop} soundOn={false} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
