import {
  ALargeSmall,
  ArrowUpDown,
  BookOpen,
  Eye,
  Hand,
  Maximize2,
  Music,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

/** Per-unit glyph, matching the prototype's unit cards (falls back to a book for unknown units). */
const ICONS: Record<number, LucideIcon> = {
  1: Volume2,
  2: Hand,
  3: Music,
  4: ALargeSmall,
  5: ArrowUpDown,
  6: Maximize2,
  7: Eye,
};

export function unitIcon(unit: number): LucideIcon {
  return ICONS[unit] ?? BookOpen;
}
