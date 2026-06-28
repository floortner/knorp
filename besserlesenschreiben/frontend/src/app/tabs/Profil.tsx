import { User } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { TabPlaceholder } from './TabPlaceholder';

export function Profil() {
  const { logout } = useAuth();
  return (
    <div className="space-y-6">
      <TabPlaceholder
        title="Profil"
        subtitle="Name, Buddy, Fortschritt"
        icon={User}
        milestone="Profil, Fortschritt & Eltern-Bereich folgen in Meilenstein 6/8."
      />
      <Button variant="ghost" className="w-full" onClick={logout}>
        Abmelden
      </Button>
    </div>
  );
}
