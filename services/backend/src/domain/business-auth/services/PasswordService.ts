import { HttpError } from "@backend-utils";

/**
 * Argon2id password hashing via `Bun.password` (native, RustCrypto-backed).
 * Defaults (64 MiB memory, t=2) exceed OWASP minimums; output is a portable
 * PHC string.
 */
export class PasswordService {
    static readonly MIN_LENGTH = 10;
    static readonly MAX_LENGTH = 128;

    /**
     * Shared password-policy gate for every password-capturing route
     * (register, reset/confirm, link/password) — one check, one canonical
     * `t.ErrorResponse` shape.
     */
    assertValid(password: string): void {
        if (!this.isValidPassword(password)) {
            throw HttpError.badRequest(
                "WEAK_PASSWORD",
                `Password must be at least ${PasswordService.MIN_LENGTH} characters`
            );
        }
    }

    /**
     * Pre-computed hash of an unguessable value, used to equalize timing on
     * unknown-email logins (enumeration resistance): verifying against this
     * dummy costs the same argon2id work as a real verification.
     */
    private dummyHashPromise: Promise<string> | null = null;

    isValidPassword(password: string): boolean {
        return (
            password.length >= PasswordService.MIN_LENGTH &&
            password.length <= PasswordService.MAX_LENGTH
        );
    }

    async hash(password: string): Promise<string> {
        return Bun.password.hash(password, { algorithm: "argon2id" });
    }

    async verify(password: string, hash: string): Promise<boolean> {
        return Bun.password.verify(password, hash);
    }

    /**
     * Constant-work verification: when the account (or its password
     * credential) doesn't exist, burn the same argon2id cost against a dummy
     * hash and return false. Callers never learn whether the email exists.
     */
    async verifyOrDummy(
        password: string,
        hash: string | null | undefined
    ): Promise<boolean> {
        if (hash) {
            return this.verify(password, hash);
        }
        const dummy = await this.getDummyHash();
        await this.verify(password, dummy);
        return false;
    }

    private getDummyHash(): Promise<string> {
        if (!this.dummyHashPromise) {
            const random = crypto.getRandomValues(new Uint8Array(32));
            this.dummyHashPromise = this.hash(
                Buffer.from(random).toString("hex")
            );
        }
        return this.dummyHashPromise;
    }
}
