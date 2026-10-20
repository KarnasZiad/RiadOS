import { spawnSync } from 'node:child_process';
import { describe, expect, inject, it } from 'vitest';

// pnpm scripts run from apps/api.
const API_ROOT = process.cwd();

describe('Database schema', () => {
  it('matches the Prisma schema once every migration is applied (no drift)', () => {
    const databaseUrl = inject('databaseOwnerUrl');
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        `"${databaseUrl}"`,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      {
        cwd: API_ROOT,
        encoding: 'utf8',
        shell: true,
        env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
      },
    );

    // Exit code 0: empty diff. Exit code 2: the migrations and the schema disagree.
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
