import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  // React logs the caught error to console.error; silence it so the test output stays clean.
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows the default fallback (with a reload button) when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Da ist etwas schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('renders a custom fallback and recovers via reset', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error('once');
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary
        fallback={(reset) => (
          <button
            onClick={() => {
              shouldThrow = false;
              reset();
            }}
          >
            retry
          </button>
        )}
      >
        <Maybe />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
