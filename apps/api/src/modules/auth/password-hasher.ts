import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** OWASP Password Storage Cheat Sheet: Argon2id (library default), 19 MiB, 2 iterations, 1 lane. */
const ARGON2ID_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

@Injectable()
export class PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2ID_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /**
   * Costs as much as a real verification. Used when the account does not exist, so response times
   * do not reveal which e-mail addresses are registered.
   */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('riados-timing-equalizer');
    await verify(await this.dummyHash, password);
  }
}
