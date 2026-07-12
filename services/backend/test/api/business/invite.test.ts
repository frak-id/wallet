import { beforeEach, describe, expect, it, vi } from "vitest";

// `Bun.password` is unavailable in the Node test environment (same trick as
// `passwordReset.test.ts` / `PasswordService.test.ts`).
const bunPassword = {
    hash: async (password: string) => `hashed:${password}`,
    verify: async (password: string, hash: string) =>
        hash === `hashed:${password}`,
};
type GlobalWithBun = typeof globalThis & { Bun?: Record<string, unknown> };
const globalWithBun = globalThis as GlobalWithBun;
globalWithBun.Bun = { ...globalWithBun.Bun, password: bunPassword };

const {
    accountRepositoryMocks,
    sessionServiceMocks,
    merchantRepositoryMocks,
    merchantAdminRepositoryMocks,
    jwtBusinessInvitationMocks,
} = vi.hoisted(() => ({
    accountRepositoryMocks: {
        findById: vi.fn(),
        setPasswordHash: vi.fn(),
        setDisplayName: vi.fn(),
        markEmailVerified: vi.fn(),
    },
    sessionServiceMocks: {
        create: vi.fn(),
    },
    merchantRepositoryMocks: {
        findById: vi.fn(),
    },
    merchantAdminRepositoryMocks: {
        isAdmin: vi.fn(),
    },
    jwtBusinessInvitationMocks: {
        sign: vi.fn(),
        verify: vi.fn(),
    },
}));

vi.mock("../../../src/domain/business-auth", async () => {
    const { PasswordService } = await import(
        "../../../src/domain/business-auth/services/PasswordService"
    );
    const { inviterLabel, isCredentialLessAccount } = await import(
        "../../../src/domain/business-auth/services/BusinessAccountService"
    );
    return {
        inviterLabel,
        isCredentialLessAccount,
        BusinessAuthContext: {
            repositories: { account: accountRepositoryMocks },
            services: {
                password: new PasswordService(),
                session: sessionServiceMocks,
            },
        },
    };
});

vi.mock("../../../src/domain/merchant", () => ({
    MerchantContext: {
        repositories: {
            merchant: merchantRepositoryMocks,
            merchantAdmin: merchantAdminRepositoryMocks,
        },
    },
}));

import { inviteRoutes } from "../../../src/api/business/auth/invite";
// Shared infra mocks (rate limiter no-op, log, JwtContext, …).
import "../../mock/common";
import { JwtContextMock } from "../../mock/common";

Object.assign(JwtContextMock, {
    businessInvitation: jwtBusinessInvitationMocks,
});

const MERCHANT_ID = "00000000-0000-0000-0000-0000000000m1";
const ACCOUNT_ID = "00000000-0000-0000-0000-0000000000c1";
const INVITER_ID = "00000000-0000-0000-0000-0000000000ac";

const VALID_PAYLOAD = {
    typ: "business-invitation" as const,
    sub: ACCOUNT_ID,
    merchantId: MERCHANT_ID,
    email: "invited@acme.com",
    invitedBy: INVITER_ID,
};

const INVITED_ACCOUNT = {
    id: ACCOUNT_ID,
    email: "invited@acme.com",
    passwordHash: null,
    displayName: null,
};

const CLAIMED_ACCOUNT = {
    ...INVITED_ACCOUNT,
    passwordHash: "hashed:already-set",
};

function post(path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("Business invitation routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        merchantRepositoryMocks.findById.mockResolvedValue({
            id: MERCHANT_ID,
            name: "Acme Corp",
        });
        merchantAdminRepositoryMocks.isAdmin.mockResolvedValue(true);
        sessionServiceMocks.create.mockResolvedValue({
            token: "new-session-token",
            session: {
                expiresAt: new Date("2024-03-01T00:00:00.000Z"),
            },
        });
    });

    describe("POST /invite/preview", () => {
        it("returns merchant + inviter context for a valid, unclaimed token", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockImplementation((id: string) => {
                if (id === ACCOUNT_ID) return Promise.resolve(INVITED_ACCOUNT);
                if (id === INVITER_ID) {
                    return Promise.resolve({
                        id: INVITER_ID,
                        email: "owner@acme.com",
                        displayName: "Jane Owner",
                    });
                }
                return Promise.resolve(null);
            });

            const response = await inviteRoutes.handle(
                post("/invite/preview", { token: "valid-token" })
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({
                email: "invited@acme.com",
                merchantName: "Acme Corp",
                inviterName: "Jane Owner",
                alreadyClaimed: false,
            });
        });

        it("falls back to a generic inviter label when invitedBy is null", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue({
                ...VALID_PAYLOAD,
                invitedBy: null,
            });
            accountRepositoryMocks.findById.mockResolvedValue(INVITED_ACCOUNT);

            const response = await inviteRoutes.handle(
                post("/invite/preview", { token: "valid-token" })
            );

            expect(await response.json()).toMatchObject({
                inviterName: "a team admin",
            });
        });

        it("reports alreadyClaimed for a credentialed account", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue(CLAIMED_ACCOUNT);

            const response = await inviteRoutes.handle(
                post("/invite/preview", { token: "valid-token" })
            );

            expect(await response.json()).toMatchObject({
                alreadyClaimed: true,
            });
        });

        it("collapses a bad signature to a generic invalid-invitation error", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(false);

            const response = await inviteRoutes.handle(
                post("/invite/preview", { token: "garbage" })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "INVALID_INVITATION",
            });
        });

        it("collapses an email mismatch to the same generic error (defense in depth)", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue({
                ...INVITED_ACCOUNT,
                email: "someone-else@acme.com",
            });

            const response = await inviteRoutes.handle(
                post("/invite/preview", { token: "valid-token" })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "INVALID_INVITATION",
            });
        });
    });

    describe("POST /invite/claim", () => {
        const claimBody = {
            token: "valid-token",
            password: "brand-new-password",
            displayName: "New Admin",
        };

        it("activates the account, marks email verified, mints a 2FA-verified session", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue(INVITED_ACCOUNT);

            const response = await inviteRoutes.handle(
                post("/invite/claim", claimBody)
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                token: "new-session-token",
                merchantId: MERCHANT_ID,
                hasMerchantAccess: true,
            });
            expect(accountRepositoryMocks.setPasswordHash).toHaveBeenCalledWith(
                {
                    accountId: ACCOUNT_ID,
                    passwordHash: "hashed:brand-new-password",
                }
            );
            expect(accountRepositoryMocks.setDisplayName).toHaveBeenCalledWith(
                ACCOUNT_ID,
                "New Admin"
            );
            expect(
                accountRepositoryMocks.markEmailVerified
            ).toHaveBeenCalledWith(ACCOUNT_ID);
            expect(sessionServiceMocks.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountId: ACCOUNT_ID,
                    authMethod: "password",
                    twoFactorVerified: true,
                })
            );
        });

        it("never inserts/checks a merchant_admins row (revocation stays authoritative)", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue(INVITED_ACCOUNT);
            merchantAdminRepositoryMocks.isAdmin.mockResolvedValue(false);

            const response = await inviteRoutes.handle(
                post("/invite/claim", claimBody)
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                hasMerchantAccess: false,
            });
            expect(merchantAdminRepositoryMocks.isAdmin).toHaveBeenCalledWith(
                MERCHANT_ID,
                { accountId: ACCOUNT_ID }
            );
        });

        it("rejects an already-claimed (credentialed) account", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue(CLAIMED_ACCOUNT);

            const response = await inviteRoutes.handle(
                post("/invite/claim", claimBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "INVALID_INVITATION",
            });
            expect(
                accountRepositoryMocks.setPasswordHash
            ).not.toHaveBeenCalled();
            expect(sessionServiceMocks.create).not.toHaveBeenCalled();
        });

        it("rejects a bad/expired signature", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(false);

            const response = await inviteRoutes.handle(
                post("/invite/claim", claimBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "INVALID_INVITATION",
            });
        });

        it("rejects a weak password before touching the account", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue(INVITED_ACCOUNT);

            const response = await inviteRoutes.handle(
                post("/invite/claim", { ...claimBody, password: "short" })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "WEAK_PASSWORD",
            });
            expect(
                accountRepositoryMocks.setPasswordHash
            ).not.toHaveBeenCalled();
        });

        it("rejects an email mismatch between token and account row", async () => {
            jwtBusinessInvitationMocks.verify.mockResolvedValue(VALID_PAYLOAD);
            accountRepositoryMocks.findById.mockResolvedValue({
                ...INVITED_ACCOUNT,
                email: "someone-else@acme.com",
            });

            const response = await inviteRoutes.handle(
                post("/invite/claim", claimBody)
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "INVALID_INVITATION",
            });
        });
    });
});
