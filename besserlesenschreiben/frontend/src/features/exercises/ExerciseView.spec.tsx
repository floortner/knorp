import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { ExerciseView } from './ExerciseView';

const items = (session as unknown as { items: Exercise[] }).items;

const noop = () => {};

describe('ExerciseView golden render', () => {
  // Pins the rendering contract for all 17 types against the golden fixture.
  for (const ex of items) {
    it(`renders ${ex.type} from backend JSON`, () => {
      const { container } = render(
        <ExerciseView ex={ex} onAttempt={noop} onSolved={noop} soundOn={false} />,
      );
      expect(container).toMatchSnapshot();
    });
  }
});

describe('renderer safety', () => {
  it('throws on an unknown exercise type (so the lesson boundary can catch it)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bogus = { id: 'x', type: 'mystery', skillTags: [] } as unknown as Exercise;
    expect(() =>
      render(<ExerciseView ex={bogus} onAttempt={noop} onSolved={noop} soundOn={false} />),
    ).toThrow(/Unhandled exercise type: mystery/);
    spy.mockRestore();
  });
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

describe('pair-match interaction (pairs)', () => {
  const pairs = items.find((i) => i.type === 'pairs')!;

  it('solves when both rhyming tiles are picked; a wrong pair clears for a retry', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={pairs} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // pairs fixture: tiles Haus/Tisch/Maus/Ball, correct pair Haus+Maus
    await user.click(screen.getByRole('button', { name: 'Haus' }));
    await user.click(screen.getByRole('button', { name: 'Tisch' })); // wrong second pick
    expect(onAttempt).toHaveBeenLastCalledWith('Haus+Tisch', false);
    expect(onSolved).not.toHaveBeenCalled();

    // the wrong-pair selection clears after ~700ms; wait it out, then the correct pair solves
    await act(async () => {
      await new Promise((r) => setTimeout(r, 750));
    });
    await user.click(screen.getByRole('button', { name: 'Haus' }));
    await user.click(screen.getByRole('button', { name: 'Maus' }));
    expect(onAttempt).toHaveBeenLastCalledWith('Haus+Maus', true);
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
