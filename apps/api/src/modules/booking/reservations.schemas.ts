import { ReservationStatus } from '@prisma/client';
import { z } from 'zod';

export const CreateReservationSchema = z.object({
  roomId: z.uuid(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.int().min(1).max(20),
  children: z.int().min(0).max(20).default(0),
  guest: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email().max(254).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number')
      .optional(),
  }),
  notes: z.string().trim().max(1_000).optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const DateRangeQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

export const ListReservationsQuerySchema = DateRangeQuerySchema.extend({
  status: z.enum(ReservationStatus).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListReservationsQuery = z.infer<typeof ListReservationsQuerySchema>;
