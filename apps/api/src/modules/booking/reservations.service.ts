import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { z } from 'zod';
import { decodeCursor, encodeCursor } from '../../common/cursor';
import {
  isConstraintViolation,
  retryOnSerializationFailure,
} from '../../infrastructure/prisma/prisma-errors';
import { TenantDb, type TenantTx } from '../../infrastructure/prisma/tenant-db.service';
import { LockNotAcquiredError, RedisLock } from '../../infrastructure/redis/redis-lock.service';
import type { AuthUser } from '../auth/auth.types';
import { assertBookable, BookingRuleViolation, MAX_CALENDAR_DAYS } from './domain/booking-policy';
import { DateRange, formatIsoDate, InvalidDateRangeError } from './domain/date-range';
import { quoteStay } from './domain/pricing';
import {
  RESERVATION_VIEW_INCLUDE,
  type ReservationView,
  toReservationView,
} from './reservation.view';
import type {
  CreateReservationInput,
  DateRangeQuery,
  ListReservationsQuery,
} from './reservations.schemas';

/** Name of the exclusion constraint created by the initial migration. */
export const NO_OVERLAP_CONSTRAINT = 'reservations_no_overlap';

const LOCK_TTL_MS = 5_000;

const CursorSchema = z.object({ checkIn: z.iso.date(), id: z.uuid() });

export interface ReservationPage {
  items: ReservationView[];
  nextCursor: string | null;
}

export interface RoomAvailability {
  id: string;
  name: string;
  capacity: number;
  reservations: {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: ReservationStatus;
  }[];
}

export interface AvailabilityView {
  from: string;
  to: string;
  rooms: RoomAvailability[];
}

function roomUnavailable(): ConflictException {
  return new ConflictException('This room is already booked for some of these nights');
}

function parseRange(from: string, to: string): DateRange {
  try {
    return DateRange.parse(from, to);
  } catch (error) {
    if (error instanceof InvalidDateRangeError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

/**
 * Booking application service.
 *
 * Creating a reservation stacks three guarantees against overbooking (ADR 0003): a Redis lock per
 * room, a SERIALIZABLE transaction re-reading overlaps, and the database exclusion constraint.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly db: TenantDb,
    private readonly lock: RedisLock,
  ) {}

  async create(caller: AuthUser, input: CreateReservationInput): Promise<ReservationView> {
    const stay = parseRange(input.checkIn, input.checkOut);
    const lockKey = `riados:lock:${caller.tenantId}:room:${input.roomId}`;

    try {
      const record = await this.lock.withLock(lockKey, { ttlMs: LOCK_TTL_MS }, () =>
        retryOnSerializationFailure(() =>
          this.db.run(caller.tenantId, (tx) => this.insert(tx, caller, input, stay), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }),
        ),
      );
      return toReservationView(record);
    } catch (error) {
      if (error instanceof LockNotAcquiredError) {
        throw new ConflictException('This room is being booked right now, please try again');
      }
      if (isConstraintViolation(error, NO_OVERLAP_CONSTRAINT)) {
        throw roomUnavailable();
      }
      if (error instanceof BookingRuleViolation) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }
  }

  async cancel(caller: AuthUser, reservationId: string): Promise<ReservationView> {
    const record = await this.db.run(caller.tenantId, async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, tenantId: caller.tenantId },
        include: RESERVATION_VIEW_INCLUDE,
      });
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }
      if (reservation.status === ReservationStatus.CANCELLED) {
        return reservation;
      }
      if (reservation.status === ReservationStatus.CHECKED_OUT) {
        throw new UnprocessableEntityException('A completed stay cannot be cancelled');
      }
      return tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED },
        include: RESERVATION_VIEW_INCLUDE,
      });
    });
    return toReservationView(record);
  }

  /** Reservations overlapping [from, to), keyset-paginated on (checkIn, id): no OFFSET scans. */
  async list(caller: AuthUser, query: ListReservationsQuery): Promise<ReservationPage> {
    const range = parseRange(query.from, query.to);
    const cursor = query.cursor ? decodeCursor(query.cursor, CursorSchema) : undefined;
    const after: Prisma.ReservationWhereInput = cursor
      ? {
          OR: [
            { checkIn: { gt: new Date(cursor.checkIn) } },
            { checkIn: new Date(cursor.checkIn), id: { gt: cursor.id } },
          ],
        }
      : {};

    const rows = await this.db.run(caller.tenantId, (tx) =>
      tx.reservation.findMany({
        where: {
          tenantId: caller.tenantId,
          status: query.status,
          checkIn: { lt: range.end },
          checkOut: { gt: range.start },
          ...after,
        },
        orderBy: [{ checkIn: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
        include: RESERVATION_VIEW_INCLUDE,
      }),
    );

    const items = rows.slice(0, query.limit).map(toReservationView);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ checkIn: last.checkIn, id: last.id })
          : null,
    };
  }

  /** Calendar data: active rooms with their non-cancelled reservations in [from, to). */
  async availability(caller: AuthUser, query: DateRangeQuery): Promise<AvailabilityView> {
    const range = parseRange(query.from, query.to);
    if (range.nights > MAX_CALENDAR_DAYS) {
      throw new BadRequestException(`The calendar spans at most ${MAX_CALENDAR_DAYS} days`);
    }

    const { rooms, reservations } = await this.db.run(caller.tenantId, async (tx) => ({
      rooms: await tx.room.findMany({
        where: { tenantId: caller.tenantId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, capacity: true },
      }),
      reservations: await tx.reservation.findMany({
        where: {
          tenantId: caller.tenantId,
          status: { not: ReservationStatus.CANCELLED },
          checkIn: { lt: range.end },
          checkOut: { gt: range.start },
        },
        orderBy: { checkIn: 'asc' },
        select: {
          id: true,
          roomId: true,
          checkIn: true,
          checkOut: true,
          status: true,
          guest: { select: { fullName: true } },
        },
      }),
    }));

    return {
      from: query.from,
      to: query.to,
      rooms: rooms.map((room) => ({
        ...room,
        reservations: reservations
          .filter((reservation) => reservation.roomId === room.id)
          .map((reservation) => ({
            id: reservation.id,
            guestName: reservation.guest.fullName,
            checkIn: formatIsoDate(reservation.checkIn),
            checkOut: formatIsoDate(reservation.checkOut),
            status: reservation.status,
          })),
      })),
    };
  }

  private async insert(
    tx: TenantTx,
    caller: AuthUser,
    input: CreateReservationInput,
    stay: DateRange,
  ) {
    const room = await tx.room.findFirst({
      where: { id: input.roomId, tenantId: caller.tenantId },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertBookable(stay, room, input);

    const overlapping = await tx.reservation.count({
      where: {
        tenantId: caller.tenantId,
        roomId: room.id,
        status: { not: ReservationStatus.CANCELLED },
        checkIn: { lt: stay.end },
        checkOut: { gt: stay.start },
      },
    });
    if (overlapping > 0) {
      throw roomUnavailable();
    }

    const { currency } = await tx.tenant.findUniqueOrThrow({
      where: { id: caller.tenantId },
      select: { currency: true },
    });
    const quote = quoteStay(room.baseRateCents, stay);
    const guest = await tx.guest.create({ data: { tenantId: caller.tenantId, ...input.guest } });

    return tx.reservation.create({
      data: {
        tenantId: caller.tenantId,
        roomId: room.id,
        guestId: guest.id,
        checkIn: stay.start,
        checkOut: stay.end,
        adults: input.adults,
        children: input.children,
        totalCents: quote.totalCents,
        currency,
        notes: input.notes ?? null,
        createdById: caller.userId,
      },
      include: RESERVATION_VIEW_INCLUDE,
    });
  }
}
