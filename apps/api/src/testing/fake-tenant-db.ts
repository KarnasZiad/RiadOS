import type { Prisma } from '@prisma/client';
import type {
  TenantDb,
  TenantTx,
  TenantTxOptions,
} from '../infrastructure/prisma/tenant-db.service';

export interface TenantDbCall {
  tenantId: string;
  isolationLevel: Prisma.TransactionIsolationLevel | undefined;
}

/** Runs the work against a mocked transaction client and records the tenant of each transaction. */
export class FakeTenantDb {
  readonly calls: TenantDbCall[] = [];
  private readonly failures: Error[] = [];

  constructor(private readonly tx: unknown) {}

  /** The next transaction fails with this error before running the work (e.g. a serialization failure). */
  failNextWith(error: Error): this {
    this.failures.push(error);
    return this;
  }

  run<T>(
    tenantId: string,
    work: (tx: TenantTx) => Promise<T>,
    options: TenantTxOptions = {},
  ): Promise<T> {
    this.calls.push({ tenantId, isolationLevel: options.isolationLevel });
    const failure = this.failures.shift();
    if (failure) {
      return Promise.reject(failure);
    }
    return work(this.tx as TenantTx);
  }

  asTenantDb(): TenantDb {
    return this as unknown as TenantDb;
  }
}
