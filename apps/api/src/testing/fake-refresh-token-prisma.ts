import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';

export interface RefreshTokenRow {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface RefreshTokenWhere {
  id?: string;
  familyId?: string;
  userId?: string;
  revokedAt?: null;
}

function matches(row: RefreshTokenRow, where: RefreshTokenWhere): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.familyId === undefined || row.familyId === where.familyId) &&
    (where.userId === undefined || row.userId === where.userId) &&
    (!('revokedAt' in where) || row.revokedAt === null)
  );
}

/** In-memory `refreshToken` delegate, enough to exercise the rotation rules. */
export class FakeRefreshTokenPrisma {
  readonly rows: RefreshTokenRow[] = [];

  /** Simulates a concurrent rotation consuming the token between the read and the update. */
  loseNextConsumptionRace = false;

  readonly refreshToken = {
    create: ({
      data,
    }: {
      data: Pick<RefreshTokenRow, 'userId' | 'familyId' | 'tokenHash' | 'expiresAt'>;
    }) => {
      const row: RefreshTokenRow = {
        id: randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.rows.push(row);
      return Promise.resolve(row);
    },
    findUnique: ({ where }: { where: { tokenHash: string } }) =>
      Promise.resolve(this.rows.find((row) => row.tokenHash === where.tokenHash) ?? null),
    updateMany: ({ where, data }: { where: RefreshTokenWhere; data: { revokedAt: Date } }) => {
      if (this.loseNextConsumptionRace && where.id !== undefined) {
        this.loseNextConsumptionRace = false;
        return Promise.resolve({ count: 0 });
      }
      const matching = this.rows.filter((row) => matches(row, where));
      for (const row of matching) {
        row.revokedAt = data.revokedAt;
      }
      return Promise.resolve({ count: matching.length });
    },
  };

  $transaction<T>(work: (tx: this) => Promise<T>): Promise<T> {
    return work(this);
  }

  asPrisma(): PrismaService {
    return this as unknown as PrismaService;
  }
}
