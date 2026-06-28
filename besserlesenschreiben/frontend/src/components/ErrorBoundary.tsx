import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives a reset callback that re-mounts the subtree. */
  fallback?: (reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/lifecycle throws so a single bad exercise (or any component) never blanks the app
 * (ARCHITECTURE §5 — the UI degrades gracefully). Wrap the whole app and the LessonRunner separately
 * so a renderer throw drops back to a friendly card without losing the rest of the shell.
 *
 * Note: we deliberately do NOT log the error payload — exercise/answer content is sensitive (CLAUDE.md
 * §6). A real client error reporter would scrub before sending; for now we only flip to the fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  // Intentionally no componentDidCatch payload logging — exercise/answer content is sensitive
  // (CLAUDE.md §6). Hook a scrubbed client error reporter here later if needed.

  reset = (): void => this.setState({ hasError: false });

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);

    return (
      <main className="bg-blobs flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl" aria-hidden>
          🛟
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold text-ink">Da ist etwas schiefgelaufen</h1>
        <p className="mt-2 max-w-xs text-ink-soft">
          Keine Sorge — dein Fortschritt ist gespeichert. Lade die Seite einfach neu.
        </p>
        <Button className="mt-8" size="lg" onClick={() => window.location.reload()}>
          Neu laden
        </Button>
      </main>
    );
  }
}
