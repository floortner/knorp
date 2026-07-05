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
