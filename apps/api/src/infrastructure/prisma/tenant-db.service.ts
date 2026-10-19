import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type TenantTx = Prisma.TransactionClient;

export interface TenantTxOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Runs work in a transaction bound to one tenant.
 *
 * PostgreSQL Row-Level Security policies read `app.tenant_id`. It is set with `is_local = true`, so
 * it disappears at commit and a pooled connection never carries the tenant of a previous request.
 */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    tenantId: string,
    work: (tx: TenantTx) => Promise<T>,
    options: TenantTxOptions = {},
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return work(tx);
      },
      {
        isolationLevel: options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 10_000,
      },
    );
  }
}
