import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockVerifyTicket,
    mockProofVerify,
    mockResolveAndAssociate,
    mockWalletVerify,
} = vi.hoisted(() => ({
    mockVerifyTicket: vi.fn(),
    mockProofVerify: vi.fn(),
    mockResolveAndAssociate: vi.fn(),
    mockWalletVerify: vi.fn(),
}));

vi.mock("../../../../src/domain/identity", () => ({
    IdentityContext: {
        services: {
            installCode: {
                verifyTicket: mockVerifyTicket,
            },
            identityProof: {
                verify: mockProofVerify,
            },
        },
    },
}));

vi.mock("../../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            identity: {
                resolveAndAssociate: mockResolveAndAssociate,
            },
        },
    },
}));

/**
 * `ensure.ts`'s local `headers: t.Partial(t.Object({"x-frak-client-id":
 * ...}))` schema replaces (rather than merges with) the real
 * `sessionContext` plugin's `.guard({headers: {"x-wallet-auth", ...}})`
 * schema — Elysia only exposes properties declared in a route's own local
 * schema to handlers/macros, so the real `withWalletOrSdkAuthent` macro
 * never sees `x-wallet-auth`/`x-wallet-sdk-auth` on this route and always
 * 401s, independent of Phase 3 (reproduced against a clean `git stash` of
 * HEAD with a real signed JWT, no mocks). Pre-existing, out of scope here —
 * flagged separately. Worked around locally by reading the auth header off
 * `request` (unfiltered by any schema) instead of the schema-filtered
 * `headers`, exactly like `ensure.ts`'s own existing
 * `request.headers.get("x-frak-client-id")` fallback does for the same
 * reason.
 */
vi.mock("@backend-infrastructure", () => {
    class UnauthorizedError extends Error {}
    const testSessionContext = new Elysia({ name: "Macro.session.test" })
        .error({ UNAUTHORIZED: UnauthorizedError })
        .onError({ as: "global" }, ({ code, set }: any) => {
            if (code === "UNAUTHORIZED") {
                set.status = 401;
                return "Unauthorized";
            }
        })
        .macro({
            withWalletOrSdkAuthent: {
                async resolve({ request }: any) {
                    const walletAuth = request.headers.get("x-wallet-auth");
                    if (walletAuth) {
                        const session = await mockWalletVerify(walletAuth);
                        if (session) return { walletSession: session };
                    }
                    throw new UnauthorizedError();
                },
            },
        });

    return {
        log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        rateLimitMiddleware: () => new Elysia({ name: "Mock.rateLimit" }),
        sessionContext: testSessionContext,
    };
});

import { identityEnsureRoutes } from "../../../../src/api/user/identity/ensure";

const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";
const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";

function walletAuthed() {
    mockWalletVerify.mockResolvedValueOnce({ address: WALLET_ADDRESS });
}

async function postEnsure(body: Record<string, unknown>) {
    return identityEnsureRoutes.handle(
        new Request("http://localhost/ensure", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-wallet-auth": "valid-wallet-jwt",
            },
            body: JSON.stringify(body),
        })
    );
}

describe("POST /identity/ensure — resolution order (README §5)", () => {
    beforeEach(() => {
        mockVerifyTicket.mockReset();
        mockProofVerify.mockReset();
        mockResolveAndAssociate.mockReset();
        mockWalletVerify.mockReset();
        mockResolveAndAssociate.mockResolvedValue({
            finalGroupId: "group-1",
            merged: true,
        });
    });

    it("old shape: bare anonymousId, no ticket, no proof — unchanged", async () => {
        walletAuthed();

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-legacy",
        });

        expect(response.status).toBe(200);
        expect(mockVerifyTicket).not.toHaveBeenCalled();
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET_ADDRESS },
            {
                type: "anonymous_fingerprint",
                value: "anon-legacy",
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("proof + anonymousId arm: verifies and observes, never rejects on invalid proof", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-1",
            proof: "some-proof",
        });

        expect(response.status).toBe(200);
        expect(mockVerifyTicket).not.toHaveBeenCalled();
        expect(mockProofVerify).toHaveBeenCalledWith(
            expect.objectContaining({
                op: "frak-ensure-v1",
                proof: "some-proof",
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            })
        );
        expect(mockResolveAndAssociate).toHaveBeenCalled();
    });

    it("ticket arm takes priority: authenticates anonymousId from the ticket, skips the proof arm", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            anonymousId: "anon-from-ticket",
            merchantId: MERCHANT_ID,
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            ticket: "valid-ticket",
        });

        expect(response.status).toBe(200);
        expect(mockVerifyTicket).toHaveBeenCalledWith("valid-ticket");
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET_ADDRESS },
            {
                type: "anonymous_fingerprint",
                value: "anon-from-ticket",
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("ticket + matching anonymousId: allowed", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            anonymousId: "anon-from-ticket",
            merchantId: MERCHANT_ID,
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-from-ticket",
            ticket: "valid-ticket",
        });

        expect(response.status).toBe(200);
    });

    it("ticket + mismatching anonymousId: rejected", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            anonymousId: "anon-from-ticket",
            merchantId: MERCHANT_ID,
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "some-other-anon-id",
            ticket: "valid-ticket",
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("ANONYMOUS_ID_MISMATCH");
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("invalid/expired ticket: rejected outright, never downgraded to the legacy arm", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue(null);

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-legacy",
            ticket: "expired-ticket",
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("INVALID_TICKET");
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("ticket merchant mismatch: rejected", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            anonymousId: "anon-from-ticket",
            merchantId: "660e8400-e29b-41d4-a716-446655440000",
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            ticket: "valid-ticket",
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("MERCHANT_MISMATCH");
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("none of ticket/proof+anonymousId/anonymousId supplied: clean 4xx, not a crash", async () => {
        walletAuthed();

        const response = await postEnsure({ merchantId: MERCHANT_ID });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("MISSING_ANONYMOUS_ID");
    });
});
