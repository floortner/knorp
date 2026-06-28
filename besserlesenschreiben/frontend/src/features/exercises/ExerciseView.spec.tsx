import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { ExerciseView } from './ExerciseView';

const items = (session as unknown as { items: Exercise[] }).items;

const noop = () => {};

describe('ExerciseView golden render', () => {
  // Pins the rendering contract for all 12 types against the golden fixture.
  for (const ex of items) {
    it(`renders ${ex.type} from backend JSON`, () => {
      const { container } = render(
        <ExerciseView ex={ex} onAttempt={noop} onSolved={noop} soundOn={false} />,
      );
      expect(container).toMatchSnapshot();
    });
  }
});

describe('single-choice interaction (count)', () => {
  const count = items.find((i) => i.type === 'count')!;

  it('reports each attempt and solves only on the correct option', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={count} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    await user.click(screen.getByRole('button', { name: '3' })); // wrong
    expect(onAttempt).toHaveBeenLastCalledWith('3', false);
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.getByText(/Nochmal versuchen/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2' })); // correct
    expect(onAttempt).toHaveBeenLastCalledWith('2', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('tile-order interaction (order)', () => {
  const order = items.find((i) => i.type === 'order')!;

  it('solves when tiles are tapped in the syllable order', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={order} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // order fixture: word Schmetterling, syll [Schmet, ter, ling]
    await user.click(screen.getByRole('button', { name: 'Schmet' }));
    await user.click(screen.getByRole('button', { name: 'ter' }));
    await user.click(screen.getByRole('button', { name: 'ling' }));

    expect(onAttempt).toHaveBeenCalledWith('Schmet|ter|ling', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});
