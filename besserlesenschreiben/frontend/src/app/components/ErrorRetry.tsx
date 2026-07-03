import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';

/**
 * Calm, child-friendly error state with a **retry** — replaces bare dead-end error notes so a transient
 * network/query failure isn't a wall the child (or parent) can't get past. Pass the query's `refetch`.
 */
export function ErrorRetry({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  return (
    <div className="py-16 text-center" role="alert">
      <p className="text-ink-soft">{errorMessage(error)}</p>
      {onRetry && (
        <Button className="mt-4" variant="ghost" onClick={onRetry}>
          Nochmal versuchen
        </Button>
      )}
    </div>
  );
}
