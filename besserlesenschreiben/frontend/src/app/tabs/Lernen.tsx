import { BookOpen } from 'lucide-react';
import { TabPlaceholder } from './TabPlaceholder';

export function Lernen() {
  return (
    <TabPlaceholder
      title="Lernen"
      subtitle="Schön, dass du da bist! 👋"
      icon={BookOpen}
      milestone="Einheiten & Übungen folgen in Meilenstein 3."
    />
  );
}
