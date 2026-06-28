import { ApiError, apiFetch } from './api';
import type { CreateAttemptBody } from './types';

/**
 * Telemetry plumbing — the product's spine (SPEC §4). Every answered item emits exactly one
 * `POST /attempts`, fire-and-forget: the child's UI never waits on the network. Failed sends queue in
 * localStorage and replay on reconnect (offline blip → sync). The backend dedupes on
 * (sessionId, itemId, attemptNo), so replays are safe.
 *
 * (A Workbox SW background-sync layer can be added later; this app-level queue is the reliable,
 * cross-browser core and survives reloads.)
 */

const QUEUE_KEY = 'blsb.attempts.queue';
const MAX_QUEUE = 500; // hard cap so a long offline stretch can't grow localStorage without bound
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // purge unsent attempts older than 48h (don't keep child data forever)

/** Stored shape: the wire body plus an enqueue timestamp (used only for retention; stripped on send). */
type QueuedAttempt = CreateAttemptBody & { queuedAt?: number };

/** Drop expired entries, then keep only the most recent MAX_QUEUE. Pure — callers persist the result. */
function prune(queue: QueuedAttempt[], now: number): QueuedAttempt[] {
  const fresh = queue.filter((a) => now - (a.queuedAt ?? now) < MAX_AGE_MS);
  return fresh.length > MAX_QUEUE ? fresh.slice(fresh.length - MAX_QUEUE) : fresh;
}

function loadQueue(): QueuedAttempt[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? prune(JSON.parse(raw) as QueuedAttempt[], Date.now()) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAttempt[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage full / unavailable — drop silently rather than break the lesson */
  }
}

/** A 4xx (except timeout/rate-limit) is the client's fault and will never succeed → drop, don't block. */
function isNonRetryable(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
}

let flushing = false;
let rerun = false;

/** Drain the queue FIFO. Stops at the first retryable failure (network/5xx) and keeps the rest. */
export async function flushAttempts(): Promise<void> {
  // If a flush is already running, mark a re-run so a connectivity change that arrives mid-flush
  // (e.g. an 'online' event) isn't dropped by the in-flight guard.
  if (flushing) {
    rerun = true;
    return;
  }
  flushing = true;
  try {
    do {
      rerun = false;
      while (loadQueue().length > 0) {
        const [head] = loadQueue();
        try {
          const body: QueuedAttempt = { ...head };
          delete body.queuedAt; // queuedAt is local-only retention metadata; never sent on the wire
          await apiFetch('/attempts', { method: 'POST', body });
        } catch (err) {
          if (!isNonRetryable(err)) break; // retry later (on next emit or 'online')
        }
        saveQueue(loadQueue().slice(1)); // re-read so concurrently-appended items are kept
      }
    } while (rerun);
  } finally {
    flushing = false;
  }
}

/** Queue an attempt and kick a flush. Returns immediately — never await this in the UI. */
export function recordAttempt(body: CreateAttemptBody): void {
  const now = Date.now();
  saveQueue(prune([...loadQueue(), { ...body, queuedAt: now }], now));
  void flushAttempts();
}

/** Number of attempts waiting to sync (offline indicator / tests). */
export function pendingAttempts(): number {
  return loadQueue().length;
}

// Replay whatever's queued as soon as connectivity returns (and once at startup).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushAttempts());
  void flushAttempts();
}
