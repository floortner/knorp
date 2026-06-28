import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ApiHandlers } from '@/lib/api';
import { ApiErrorBridge } from './ApiErrorBridge';

// Capture the handlers ApiErrorBridge registers so we can fire them like the transport would.
let captured: ApiHandlers = {};
vi.mock('@/lib/api', () => ({
  setApiHandlers: (h: ApiHandlers) => {
    captured = h;
  },
}));

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderBridge() {
  render(
    <MemoryRouter initialEntries={['/app/lernen']}>
      <ApiErrorBridge />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ApiErrorBridge', () => {
  beforeEach(() => {
    captured = {};
  });

  it('routes a 401/SESSION_EXPIRED to /login', () => {
    renderBridge();
    act(() => captured.onUnauthorized?.());
    expect(screen.getByTestId('loc')).toHaveTextContent('/login');
  });

  it('routes a 402 to the parent supporter screen', () => {
    renderBridge();
    act(() => captured.onPaymentRequired?.());
    expect(screen.getByTestId('loc')).toHaveTextContent('/parent');
  });
});
