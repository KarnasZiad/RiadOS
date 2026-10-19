import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isUniqueViolation } from '../../infrastructure/prisma/prisma-errors';
import { TenantDb } from '../../infrastructure/prisma/tenant-db.service';
import type { AuthUser } from '../auth/auth.types';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schemas';

const ROOM_VIEW = {
  id: true,
  name: true,
  capacity: true,
  baseRateCents: true,
  isActive: true,
} satisfies Prisma.RoomSelect;

export type RoomView = Prisma.RoomGetPayload<{ select: typeof ROOM_VIEW }>;

@Injectable()
export class RoomsService {
  constructor(private readonly db: TenantDb) {}

  list(caller: AuthUser): Promise<RoomView[]> {
    return this.db.run(caller.tenantId, (tx) =>
      tx.room.findMany({
        where: { tenantId: caller.tenantId },
        orderBy: { name: 'asc' },
        select: ROOM_VIEW,
      }),
    );
  }

  async create(caller: AuthUser, input: CreateRoomInput): Promise<RoomView> {
    try {
      return await this.db.run(caller.tenantId, (tx) =>
        tx.room.create({ data: { ...input, tenantId: caller.tenantId }, select: ROOM_VIEW }),
      );
    } catch (error) {
      throw translateRoomError(error, input.name);
    }
  }

  async update(caller: AuthUser, roomId: string, input: UpdateRoomInput): Promise<RoomView> {
    try {
      return await this.db.run(caller.tenantId, async (tx) => {
        const { count } = await tx.room.updateMany({
          where: { id: roomId, tenantId: caller.tenantId },
          data: input,
        });
        if (count === 0) {
          throw new NotFoundException('Room not found');
        }
        return tx.room.findUniqueOrThrow({ where: { id: roomId }, select: ROOM_VIEW });
      });
    } catch (error) {
      throw translateRoomError(error, input.name);
    }
  }
}

function translateRoomError(error: unknown, name: string | undefined): unknown {
  return isUniqueViolation(error)
    ? new ConflictException(`A room named "${name ?? ''}" already exists`)
    : error;
}
