import { beforeEach, describe, expect, it, vi } from "vitest";

// `Bun.password` is unavailable in the Node test environment — substitute a
// deterministic stand-in with the same shape (same trick as
// PasswordService.test.ts), before the routes import the service.
const bunPassword = {
    hash: async (password: string) => `hashed:${password}`,
    verify: async (password: string, hash: string) =>
        hash === `hashed:${password}`,
};
type GlobalWithBun = typeof globalThis & { Bun?: Record<string, unknown> };
const globalWithBun = globalThis as GlobalWithBun;
globalWithBun.Bun = { ...globalWithBun.Bun, password: bunPassword };

const { accountRepositoryMocks, sessionRepositoryMocks, emailOtpServiceMocks } =
    vi.hoisted(() => ({
        accountRepositoryMocks: {
            findByEmail: vi.fn(),
            create: vi.fn(),
            setPasswordHash: vi.fn(),
            markEmailVerified: vi.fn(),
        },
        sessionRepositoryMocks: {
            revokeAllForAccount: vi.fn(),
        },
        emailOtpServiceMocks: {
            sendCode: vi.fn(),
            verifyCode: vi.fn(),
        },
    }));

vi.mock("../../../src/domain/business-auth", async () => {
    const { PasswordService } = await import(
        "../../../src/domain/business-auth/services/PasswordService"
    );
    const { isCredentialLessAccount } = await import(
        "../../../src/domain/business-auth/services/BusinessAccountService"
    );
    return {
        PasswordService,
        isCredentialLessAccount,
        BusinessAuthContext: {
            repositories: {
                account: accountRepositoryMocks,
                session: sessionRepositoryMocks,
            },
            services: {
                password: new PasswordService(),
                emailOtp: emailOtpServiceMocks,
            },
        },
    };
});

import { loginRoutes } from "../../../src/api/business/auth/login";
// Shared infra mocks (rate limiter no-op, log, …).
import "../../mock/common";

const ACCOUNT = {
    id: "00000000-0000-0000-0000-00000000acc1",
    email: "user@acme.com",
    passwordHash: "hashed:old-password",
};
const SSO_ONLY_ACCOUNT = {
    id: "00000000-0000-0000-0000-00000000acc2",
    email: "sso@acme.com",
    passwordHash: null,
    shopifyUserId: "shopify-user-1",
    walletAddress: null,
};
const INVITED_ACCOUNT = {
    id: "00000000-0000-0000-0000-00000000acc4",
    email: "invited@acme.com",
    passwordHash: null,
    shopifyUserId: null,
    walletAddress: null,
};

function post(path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/** Wait for fire-and-forget promises queued by the handler to settle. */
async function flushMicrotasks(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
}

describe("Password reset routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        emailOtpServiceMocks.sendCode.mockResolvedValue({ status: "sent" });
        emailOtpServiceMocks.verifyCode.mockResolvedValue({
            status: "verified",
        });
        accountRepositoryMocks.setPasswordHash.mockResolvedValue(undefined);
        accountRepositoryMocks.markEmailVerified.mockResolvedValue(undefined);
        sessionRepositoryMocks.revokeAllForAccount.mockResolvedValue(undefined);
    });

    describe("POST /password/reset/request", () => {
        it("sends a reset code for a password account", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(ACCOUNT);

            const response = await loginRoutes.handle(
                post("/password/reset/request", { email: "User@Acme.com" })
            );

            expect(response.status).toBe(200);
            await flushMicrotasks();
            expect(emailOtpServiceMocks.sendCode).toHaveBeenCalledWith({
                accountId: ACCOUNT.id,
                email: "user@acme.com",
                purpose: "password_reset",
            });
        });

        it("is enumeration-safe: unknown email gets the identical response, no email sent", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);

            const response = await loginRoutes.handle(
                post("/password/reset/request", { email: "ghost@acme.com" })
            );
            const knownBody = await (
                await (async () => {
                    accountRepositoryMocks.findByEmail.mockResolvedValue(
                        ACCOUNT
                    );
                    return loginRoutes.handle(
                        post("/password/reset/request", {
                            email: "user@acme.com",
                        })
                    );
                })()
            ).json();

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual(knownBody);
            await flushMicrotasks();
            // Only the known-account request sent an email.
            expect(emailOtpServiceMocks.sendCode).toHaveBeenCalledTimes(1);
        });

        it("does not send a code to an SSO-only account (no password credential)", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                SSO_ONLY_ACCOUNT
            );

            const response = await loginRoutes.handle(
                post("/password/reset/request", { email: "sso@acme.com" })
            );

            expect(response.status).toBe(200);
            await flushMicrotasks();
            expect(emailOtpServiceMocks.sendCode).not.toHaveBeenCalled();
        });

        it("sends a reset code for a credential-less (invited) account — self-service unbrick", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                INVITED_ACCOUNT
            );

            const response = await loginRoutes.handle(
                post("/password/reset/request", { email: "invited@acme.com" })
            );

            expect(response.status).toBe(200);
            await flushMicrotasks();
            expect(emailOtpServiceMocks.sendCode).toHaveBeenCalledWith({
                accountId: INVITED_ACCOUNT.id,
                email: "invited@acme.com",
                purpose: "password_reset",
            });
        });
    });

    describe("POST /password/reset/confirm", () => {
        const validBody = {
            email: "user@acme.com",
            code: "123456",
            password: "brand-new-password",
        };

        it("verifies the code, sets the password, marks email verified and revokes every session", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(ACCOUNT);

            const response = await loginRoutes.handle(
                post("/password/reset/confirm", validBody)
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ success: true });
            expect(emailOtpServiceMocks.verifyCode).toHaveBeenCalledWith({
                accountId: ACCOUNT.id,
                purpose: "password_reset",
                code: "123456",
            });
            expect(accountRepositoryMocks.setPasswordHash).toHaveBeenCalledWith(
                {
                    accountId: ACCOUNT.id,
                    passwordHash: "hashed:brand-new-password",
                }
            );
            expect(
                accountRepositoryMocks.markEmailVerified
            ).toHaveBeenCalledWith(ACCOUNT.id);
            // Credential-reset hygiene: sessions established with the old
            // password must not survive.
            expect(
                sessionRepositoryMocks.revokeAllForAccount
            ).toHaveBeenCalledWith(ACCOUNT.id);
        });

        it("rejects a weak password with the canonical ErrorResponse shape", async () => {
            const response = await loginRoutes.handle(
                post("/password/reset/confirm", {
                    ...validBody,
                    password: "short",
                })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "WEAK_PASSWORD",
            });
            expect(
                accountRepositoryMocks.setPasswordHash
            ).not.toHaveBeenCalled();
        });

        it("collapses an unknown email to INVALID_CODE", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);

            const response = await loginRoutes.handle(
                post("/password/reset/confirm", validBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "INVALID_CODE",
            });
        });

        it("collapses an SSO-only account to the same INVALID_CODE", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                SSO_ONLY_ACCOUNT
            );

            const response = await loginRoutes.handle(
                post("/password/reset/confirm", validBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "INVALID_CODE",
            });
            expect(emailOtpServiceMocks.verifyCode).not.toHaveBeenCalled();
        });

        it("allows a credential-less (invited) account to complete the reset", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                INVITED_ACCOUNT
            );

            const response = await loginRoutes.handle(
                post("/password/reset/confirm", {
                    ...validBody,
                    email: "invited@acme.com",
                })
            );

            expect(response.status).toBe(200);
            expect(accountRepositoryMocks.setPasswordHash).toHaveBeenCalledWith(
                {
                    accountId: INVITED_ACCOUNT.id,
                    passwordHash: "hashed:brand-new-password",
                }
            );
            expect(
                accountRepositoryMocks.markEmailVerified
            ).toHaveBeenCalledWith(INVITED_ACCOUNT.id);
        });

        it("rejects a wrong/expired code without touching the password or sessions", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(ACCOUNT);
            emailOtpServiceMocks.verifyCode.mockResolvedValue({
                status: "invalid",
            });

            const response = await loginRoutes.handle(
                post("/password/reset/confirm", validBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "INVALID_CODE",
            });
            expect(
                accountRepositoryMocks.setPasswordHash
            ).not.toHaveBeenCalled();
            expect(
                sessionRepositoryMocks.revokeAllForAccount
            ).not.toHaveBeenCalled();
        });
    });

    describe("POST /register", () => {
        it("returns the generic response when a concurrent register wins the unique index (TOCTOU)", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);
            accountRepositoryMocks.create.mockRejectedValue(
                Object.assign(new Error("duplicate key"), { code: "23505" })
            );

            const response = await loginRoutes.handle(
                post("/register", {
                    email: "user@acme.com",
                    password: "brand-new-password",
                })
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                message: expect.stringContaining("sign in to continue"),
            });
        });

        it("creates the account without sending any email (first login's 2FA is the verification)", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);
            accountRepositoryMocks.create.mockResolvedValue({
                id: "00000000-0000-0000-0000-00000000acc3",
            });

            const response = await loginRoutes.handle(
                post("/register", {
                    email: "new@acme.com",
                    password: "brand-new-password",
                })
            );

            expect(response.status).toBe(200);
            await flushMicrotasks();
            expect(emailOtpServiceMocks.sendCode).not.toHaveBeenCalled();
            expect(accountRepositoryMocks.setPasswordHash).toHaveBeenCalledWith(
                {
                    accountId: "00000000-0000-0000-0000-00000000acc3",
                    passwordHash: "hashed:brand-new-password",
                }
            );
        });
    });
});
