/** Shared mapping for a homework review verdict → tint classes + German label. */
export function decisionTone(decision: string): string {
  if (decision === 'approved') return 'bg-good-tint text-good';
  if (decision === 'rejected') return 'bg-danger-tint text-danger';
  return 'bg-amber-tint text-amber'; // corrected (and any other)
}

export function decisionLabel(decision: string): string {
  if (decision === 'approved') return 'Bestätigt';
  if (decision === 'rejected') return 'Abgelehnt';
  return 'Korrigiert';
}

/** Homework pipeline status → German label (raw enum values must never reach the UI). */
export function statusLabel(status: string): string {
  if (status === 'pending_analysis') return 'Wird analysiert';
  if (status === 'pending_review') return 'Wartet auf Prüfung';
  if (status === 'reviewed') return 'Geprüft';
  if (status === 'rejected') return 'Abgelehnt';
  return status;
}
