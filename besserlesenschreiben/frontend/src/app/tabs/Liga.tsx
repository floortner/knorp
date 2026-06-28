import { Trophy } from 'lucide-react';
import { TabPlaceholder } from './TabPlaceholder';

export function Liga() {
  return (
    <TabPlaceholder
      title="Liga"
      subtitle="Deine Sterne diese Woche"
      icon={Trophy}
      milestone="Liga, Sterne & Heatmap folgen in Meilenstein 6."
    />
  );
}
