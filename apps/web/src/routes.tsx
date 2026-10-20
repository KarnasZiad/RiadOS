import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { CalendarPage } from './features/calendar/CalendarPage';
import { ReservationsPage } from './features/reservations/ReservationsPage';
import { RoomsPage } from './features/rooms/RoomsPage';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/calendar" replace /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'reservations', element: <ReservationsPage /> },
          { path: 'rooms', element: <RoomsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
