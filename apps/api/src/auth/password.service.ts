import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id at the OWASP-recommended second configuration:
 * 19 MiB memory, 2 iterations, 1 degree of parallelism.
 *
 * @node-rs/argon2 ships prebuilt binaries, so there is no node-gyp toolchain
 * requirement on a contributor's machine.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Never a real hash. Used only to spend time when an account does not exist. */
const DUMMY_PASSWORD = 'timing-equalisation-only-never-a-real-password';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON_OPTIONS);
  }

  /**
   * Verifies a password, tolerating a null hash (magic-link-only accounts).
   *
   * When there is no hash to check we still burn comparable CPU time. Without
   * that, "unknown email" returns in 2 ms and "wrong password" in 60 ms, and
   * the difference is a reliable account-enumeration oracle.
   */
  async verify(storedHash: string | null, plain: string): Promise<boolean> {
    if (!storedHash) {
      await this.burnTime();
      return false;
    }
    try {
      return await verify(storedHash, plain, ARGON_OPTIONS);
    } catch {
      // A malformed hash must read as "wrong password", never as a 500.
      return false;
    }
  }

  private async burnTime(): Promise<void> {
    await hash(DUMMY_PASSWORD, ARGON_OPTIONS);
  }
}