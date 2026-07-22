import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minus, Plus, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/cn';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.25;

/**
 * Homework-photo viewer: an inline preview that opens a fullscreen overlay with wheel/button zoom,
 * drag-to-pan and 90°-rotate — phone shots of a student's pencil writing need magnification
 * (ARCHITECTURE §11: reading the actual handwriting is the review). Dependency-free CSS transforms.
 */
export function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Vergrößern (Zoom & Drehen)"
        className="group relative block overflow-hidden rounded-card bg-surface p-2 text-left shadow-sm ring-1 ring-line"
      >
        <img src={src} alt={alt} className="max-h-[70vh] w-full rounded-md object-contain" />
        <span className="absolute right-3 top-3 rounded-md bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
          <Maximize2 className="size-4" aria-hidden />
        </span>
      </button>
      {open && <Overlay src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Overlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  const zoom = useCallback((factor: number) => {
    setScale((s) => {
      const next = clamp(s * factor);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 }); // fully zoomed out → recenter
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+') zoom(STEP);
      if (e.key === '-') zoom(1 / STEP);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom]);

  const onWheel = (e: WheelEvent) => zoom(e.deltaY < 0 ? STEP : 1 / STEP);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const rotate = () => {
    setRotation((r) => (r + 90) % 360);
    setOffset({ x: 0, y: 0 }); // rotating re-centers — panning offsets don't survive an axis swap intuitively
  };

  const toolBtn =
    'rounded-md bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal aria-label={alt}>
      <div className="flex items-center justify-end gap-2 p-3">
        <button type="button" onClick={() => zoom(1 / STEP)} aria-label="Verkleinern" className={toolBtn}>
          <Minus className="size-5" aria-hidden />
        </button>
        <span className="min-w-14 text-center text-sm tabular-nums text-white/80">{Math.round(scale * 100)} %</span>
        <button type="button" onClick={() => zoom(STEP)} aria-label="Vergrößern" className={toolBtn}>
          <Plus className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={rotate} aria-label="Drehen (90°)" className={toolBtn}>
          <RotateCw className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={onClose} aria-label="Schließen" className={cn(toolBtn, 'ml-2')}>
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Backdrop click closes only when not dragging a pan. */}
      <div
        className={cn('flex-1 touch-none select-none overflow-hidden', scale > 1 ? 'cursor-grab' : 'cursor-zoom-in')}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => (scale > 1 ? (setScale(1), setOffset({ x: 0, y: 0 })) : zoom(STEP * STEP))}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)` }}
        />
      </div>
    </div>,
    document.body,
  );
}
