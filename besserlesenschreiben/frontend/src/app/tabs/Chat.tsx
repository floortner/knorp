import { MessageCircle } from 'lucide-react';
import { TabPlaceholder } from './TabPlaceholder';

export function Chat() {
  return (
    <TabPlaceholder
      title="Chat"
      subtitle="Frag deine Trainerin Angelika"
      icon={MessageCircle}
      milestone="Der Trainer-Chat folgt in Meilenstein 7."
    />
  );
}
