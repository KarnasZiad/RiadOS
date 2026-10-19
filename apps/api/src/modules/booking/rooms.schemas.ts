import { z } from 'zod';

const RoomFields = {
  name: z.string().trim().min(1).max(60),
  capacity: z.int().min(1).max(20),
  /** Nightly rate in centimes (85 000 = 850,00 MAD). */
  baseRateCents: z.int().min(0).max(10_000_000),
};

export const CreateRoomSchema = z.object(RoomFields);

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const UpdateRoomSchema = z
  .object({ ...RoomFields, isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
