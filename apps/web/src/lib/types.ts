/** Shapes returned by the RiadOS API (see the OpenAPI document at /api/docs). */

export type Role = 'OWNER' | 'RECEPTION' | 'HOUSEKEEPING';

export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenant: { id: string; name: string };
}

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  baseRateCents: number;
  isActive: boolean;
}

export interface CalendarReservation {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
}

export interface RoomAvailability {
  id: string;
  name: string;
  capacity: number;
  reservations: CalendarReservation[];
}

export interface Availability {
  from: string;
  to: string;
  rooms: RoomAvailability[];
}

export interface Reservation {
  id: string;
  room: { id: string; name: string };
  guest: { id: string; fullName: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  status: ReservationStatus;
  source: 'DIRECT' | 'BOOKING_COM' | 'AIRBNB';
  adults: number;
  children: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  createdAt: string;
}

export interface ReservationPage {
  items: Reservation[];
  nextCursor: string | null;
}

export interface NewReservation {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guest: { fullName: string; email?: string; phone?: string };
  notes?: string;
}

export interface NewRoom {
  name: string;
  capacity: number;
  baseRateCents: number;
}
