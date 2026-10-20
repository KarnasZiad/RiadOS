import { CalendarDays, BedDouble, ListChecks, LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth, useCurrentUser } from '../../features/auth/auth-context';
import { ROLE_LABELS } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/feedback';

const NAVIGATION = [
  { to: '/calendar', label: 'Calendrier', icon: CalendarDays },
  { to: '/reservations', label: 'Réservations', icon: ListChecks },
  { to: '/rooms', label: 'Chambres', icon: BedDouble },
] as const;

export function AppLayout() {
  const { logout } = useAuth();
  const user = useCurrentUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="text-lg font-semibold text-brand-700">RiadOS</span>
          <span className="text-sm text-stone-500">{user.tenant.name}</span>
          <nav aria-label="Navigation principale" className="flex gap-1">
            {NAVIGATION.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100',
                    isActive && 'bg-brand-50 font-medium text-brand-700',
                  )
                }
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm">{user.fullName}</span>
            <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut aria-hidden className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
