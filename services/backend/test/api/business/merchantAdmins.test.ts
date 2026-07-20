import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    accountRepositoryMocks,
    merchantAdminRepositoryMocks,
    merchantRepositoryMocks,
    authorizationServiceMocks,
    jwtBusinessInvitationMocks,
    resendClientMocks,
} = vi.hoisted(() => ({
    accountRepositoryMocks: {
        findByEmail: vi.fn(),
        findById: vi.fn(),
    },
    merchantAdminRepositoryMocks: {
        findByMerchant: vi.fn(),
        add: vi.fn(),
        removeById: vi.fn(),
        isAdmin: vi.fn(),
    },
    merchantRepositoryMocks: {
        findById: vi.fn(),
    },
    authorizationServiceMocks: {
        hasAccess: vi.fn(),
    },
    jwtBusinessInvitationMocks: {
        sign: vi.fn(() => Promise.resolve("mock-invitation-token")),
        verify: vi.fn(),
    },
    resendClientMocks: {
        send: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock("../../../src/domain/business-auth", async () => {
    const actual = await vi.importActual<
        typeof import("../../../src/domain/business-auth")
    >("../../../src/domain/business-auth");
    return {
        isCredentialLessAccount: actual.isCredentialLessAccount,
        inviterLabel: actual.inviterLabel,
        BusinessAuthContext: {
            repositories: { account: accountRepositoryMocks },
            services: {
                account: {
                    createInvitedAccount: vi.fn((email: string) =>
                        Promise.resolve({
                            id: "00000000-0000-0000-0000-0000000000aa",
                            email,
                            passwordHash: null,
                            shopifyUserId: null,
                            walletAddress: null,
                            displayName: null,
                        })
                    ),
                },
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
        services: {
            authorization: authorizationServiceMocks,
        },
    },
}));

vi.mock("../../../src/infrastructure/integrations/email", () => ({
    buildInvitationEmail: ({
        merchantName,
        inviterName,
        link,
    }: {
        merchantName: string;
        inviterName: string;
        link: string;
    }) => ({
        subject: `You've been invited to join ${merchantName} on Frak`,
        html: `${inviterName}-${link}`,
    }),
    resendClient: resendClientMocks,
}));

// The shared mock stubs `businessSessionContext` but not the plain schema
// export `StepUpRequired401` sitting in the same module — re-add it here.
vi.mock("../../../src/api/business/middleware/session", async () => {
    const actual = await vi.importActual<
        typeof import("../../../src/api/business/middleware/session")
    >("../../../src/api/business/middleware/session");
    const { businessSessionContextMock } = await import("../../mock/common");
    return {
        businessSessionContext: businessSessionContextMock,
        StepUpRequired401: actual.StepUpRequired401,
    };
});

import { merchantAdminsRoutes } from "../../../src/api/business/merchant/admins";
// Shared infra mocks (rate limiter no-op, log, JwtContext, business session
// middleware, …).
import "../../mock/common";
import { JwtContextMock, setMockMerchantAccess } from "../../mock/common";

// Wire the invitation JWT mock into the shared JwtContext mock consumed by
// `@backend-infrastructure`.
Object.assign(JwtContextMock, {
    businessInvitation: jwtBusinessInvitationMocks,
});

const MERCHANT_ID = "00000000-0000-0000-0000-0000000000m1";
const ACCOUNT_ID_CREDENTIALED = "00000000-0000-0000-0000-0000000000c1";
const ACCOUNT_ID_INVITED = "00000000-0000-0000-0000-0000000000c2";

const CREDENTIALED_ACCOUNT = {
    id: ACCOUNT_ID_CREDENTIALED,
    email: "existing@acme.com",
    passwordHash: "hashed:pw",
    shopifyUserId: null,
    walletAddress: null,
    displayName: "Existing User",
};

const CREDENTIALLESS_ACCOUNT = {
    id: ACCOUNT_ID_INVITED,
    email: "invited@acme.com",
    passwordHash: null,
    shopifyUserId: null,
    walletAddress: null,
    displayName: null,
};

const MERCHANT = {
    id: MERCHANT_ID,
    name: "Acme Corp",
    ownerWallet: "0x1111111111111111111111111111111111111111",
    ownerAccountId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

function post(path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-business-auth": "actor-session-token",
        },
        body: JSON.stringify(body),
    });
}

function get(path: string): Request {
    return new Request(`http://localhost${path}`, {
        method: "GET",
        headers: { "x-business-auth": "actor-session-token" },
    });
}

describe("Merchant admins routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        JwtContextMock.business.verify.mockResolvedValue({
            wallet: "0x2222222222222222222222222222222222222222",
            accountId: "00000000-0000-0000-0000-0000000000ac",
        } as never);
        authorizationServiceMocks.hasAccess.mockResolvedValue(true);
        setMockMerchantAccess(true);
        merchantRepositoryMocks.findById.mockResolvedValue(MERCHANT as never);
        merchantAdminRepositoryMocks.isAdmin.mockResolvedValue(true);
    });

    describe("POST /:merchantId/admins", () => {
        it("direct-adds an existing credentialed account, status 'added', no email sent", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                CREDENTIALED_ACCOUNT
            );
            merchantAdminRepositoryMocks.add.mockResolvedValue({
                id: "admin-1",
                wallet: null,
                accountId: ACCOUNT_ID_CREDENTIALED,
                addedBy: null,
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
            });
            accountRepositoryMocks.findById.mockResolvedValue(
                CREDENTIALED_ACCOUNT
            );

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, {
                    email: "Existing@Acme.com",
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({
                status: "active",
                accountId: ACCOUNT_ID_CREDENTIALED,
                email: "existing@acme.com",
            });
            expect(merchantAdminRepositoryMocks.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    identity: { accountId: ACCOUNT_ID_CREDENTIALED },
                })
            );
            expect(resendClientMocks.send).not.toHaveBeenCalled();
            expect(jwtBusinessInvitationMocks.sign).not.toHaveBeenCalled();
        });

        it("creates an invited account + sends an invitation email for an unknown email", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);
            merchantAdminRepositoryMocks.add.mockResolvedValue({
                id: "admin-2",
                wallet: null,
                accountId: "00000000-0000-0000-0000-0000000000aa",
                addedBy: null,
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
            });
            accountRepositoryMocks.findById.mockResolvedValue(null);

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, {
                    email: "new-invite@acme.com",
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({ status: "invited" });
            expect(jwtBusinessInvitationMocks.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    typ: "business-invitation",
                    merchantId: MERCHANT_ID,
                    email: "new-invite@acme.com",
                })
            );
            expect(resendClientMocks.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "new-invite@acme.com" })
            );
        });

        it("takes the invited path (idempotent resend) when the email already resolves to a credential-less account", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(
                CREDENTIALLESS_ACCOUNT
            );
            merchantAdminRepositoryMocks.add.mockResolvedValue({
                id: "admin-3",
                wallet: null,
                accountId: ACCOUNT_ID_INVITED,
                addedBy: null,
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
            });
            accountRepositoryMocks.findById.mockResolvedValue(
                CREDENTIALLESS_ACCOUNT
            );

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, {
                    email: "invited@acme.com",
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({ status: "invited" });
            // Cross-merchant / resend: the admin row is (re-)added and a
            // fresh invitation is minted + mailed — never silently skipped.
            expect(merchantAdminRepositoryMocks.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    identity: { accountId: ACCOUNT_ID_INVITED },
                })
            );
            expect(jwtBusinessInvitationMocks.sign).toHaveBeenCalledTimes(1);
            expect(resendClientMocks.send).toHaveBeenCalledTimes(1);
        });

        it("adds by wallet without touching account resolution", async () => {
            merchantAdminRepositoryMocks.add.mockResolvedValue({
                id: "admin-4",
                wallet: "0x3333333333333333333333333333333333333333",
                accountId: null,
                addedBy: null,
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
            });

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, {
                    wallet: "0x3333333333333333333333333333333333333333",
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({ status: "active", email: null });
            expect(accountRepositoryMocks.findByEmail).not.toHaveBeenCalled();
        });

        it("returns 403 when the actor lacks access", async () => {
            // Access is now gated by the requireMerchantAccess macro, not an
            // inline authorization.hasAccess call in the handler.
            setMockMerchantAccess(false);

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, { email: "x@acme.com" })
            );

            expect(response.status).toBe(403);
            expect(merchantAdminRepositoryMocks.add).not.toHaveBeenCalled();
        });

        it("still returns 200/'invited' when the invitation email send fails (fire-and-forget)", async () => {
            accountRepositoryMocks.findByEmail.mockResolvedValue(null);
            merchantAdminRepositoryMocks.add.mockResolvedValue({
                id: "admin-5",
                wallet: null,
                accountId: "00000000-0000-0000-0000-0000000000ab",
                addedBy: null,
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
            });
            accountRepositoryMocks.findById.mockResolvedValue(null);
            resendClientMocks.send.mockRejectedValueOnce(
                new Error("Resend is down")
            );

            const response = await merchantAdminsRoutes.handle(
                post(`/${MERCHANT_ID}/admins`, {
                    email: "flaky-send@acme.com",
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            // The admin row is already persisted; a resend from the team
            // table covers a failed send — the request must not surface the
            // Resend failure to the caller.
            expect(body).toMatchObject({ status: "invited" });
            expect(merchantAdminRepositoryMocks.add).toHaveBeenCalled();

            resendClientMocks.send.mockResolvedValue(undefined);
        });
    });

    describe("GET /:merchantId/admins", () => {
        it("derives 'invited' vs 'active' status per row and 'active' for the owner", async () => {
            merchantAdminRepositoryMocks.findByMerchant.mockResolvedValue([
                {
                    id: "admin-active",
                    wallet: null,
                    accountId: ACCOUNT_ID_CREDENTIALED,
                    addedBy: null,
                    addedAt: new Date("2024-02-01T00:00:00.000Z"),
                },
                {
                    id: "admin-invited",
                    wallet: null,
                    accountId: ACCOUNT_ID_INVITED,
                    addedBy: null,
                    addedAt: new Date("2024-02-02T00:00:00.000Z"),
                },
            ]);
            accountRepositoryMocks.findById.mockImplementation((id: string) => {
                if (id === ACCOUNT_ID_CREDENTIALED) {
                    return Promise.resolve(CREDENTIALED_ACCOUNT);
                }
                if (id === ACCOUNT_ID_INVITED) {
                    return Promise.resolve(CREDENTIALLESS_ACCOUNT);
                }
                return Promise.resolve(null);
            });

            const response = await merchantAdminsRoutes.handle(
                get(`/${MERCHANT_ID}/admins`)
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            const owner = body.admins.find(
                (a: { isOwner: boolean }) => a.isOwner
            );
            const active = body.admins.find(
                (a: { id: string }) => a.id === "admin-active"
            );
            const invited = body.admins.find(
                (a: { id: string }) => a.id === "admin-invited"
            );

            expect(owner).toMatchObject({ status: "active" });
            expect(active).toMatchObject({ status: "active" });
            expect(invited).toMatchObject({ status: "invited" });
        });
    });
});
