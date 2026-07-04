import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A single modal overlay primitive: a body-portal (so it never inherits click/stacking behaviour from
 * wherever it's mounted), a scrim, and a rounded panel. `dismissable` (default true) wires Escape + a
 * backdrop click to `onClose` — turn it OFF for forms with unsaved edits so a stray click can't discard them.
 */
export function Modal({
  onClose,
  title,
  children,
  size = 'lg',
  dismissable = true,
}: {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'lg' | 'xl' | '2xl';
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissable, onClose]);

  const maxW = size === '2xl' ? 'max-w-2xl' : size === 'xl' ? 'max-w-xl' : 'max-w-lg';
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className={cn('max-h-[90vh] w-full overflow-y-auto rounded-card bg-surface p-6 shadow-xl ring-1 ring-line', maxW)}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Schließen" className="text-ink-soft hover:text-ink">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
