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
                    // Mirrors the real macro: either credential resolves a
                    // session. `ensure.ts` additionally reads
                    // `x-wallet-sdk-auth` itself to tell the SDK arm from the
                    // wallet arm, so both must be honoured here.
                    const walletAuth = request.headers.get("x-wallet-auth");
                    if (walletAuth) {
                        const session = await mockWalletVerify(walletAuth);
                        if (session) return { walletSession: session };
                    }
                    const sdkAuth = request.headers.get("x-wallet-sdk-auth");
                    if (sdkAuth) {
                        const session = await mockWalletVerify(sdkAuth);
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

/**
 * The exact request the SHIPPED Tauri binary sends. `backendClient.ts`
 * attaches `x-wallet-auth`, `x-wallet-sdk-auth` AND `x-frak-client-id` to
 * every call when all three exist in the session, and the install/ensure
 * flow POSTs a body `anonymousId` with no ticket and no proof.
 *
 * This is the regression that matters most on this branch: an installed
 * binary cannot be fixed, so anything that 4xx's this shape is a production
 * outage for every user who has not updated.
 */
describe("POST /identity/ensure — the live Tauri binary's request shape", () => {
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

    it("succeeds with both auth headers, a client-id header, and a bare body anonymousId", async () => {
        walletAuthed();

        const response = await identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-auth": "valid-wallet-jwt",
                    "x-wallet-sdk-auth": "valid-sdk-jwt",
                    "x-frak-client-id": "anon-from-store",
                },
                body: JSON.stringify({
                    merchantId: MERCHANT_ID,
                    anonymousId: "anon-body",
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET_ADDRESS },
            {
                type: "anonymous_fingerprint",
                value: "anon-body",
                merchantId: MERCHANT_ID,
            },
        ]);
    });
});

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

/**
 * SDK arm (ROLLOUT-STEP-2, README §5) — anonymousId arrives ONLY via the
 * `x-frak-client-id` header, never reaches the Tauri binary, so a
 * valid proof is now mandatory. The wallet arm (body `anonymousId` or
 * `ticket`, covered above) must stay untouched and permissive.
 */
describe("POST /identity/ensure — SDK arm (x-frak-client-id header): proof mandatory", () => {
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

    async function postEnsureViaHeader(
        body: Record<string, unknown>,
        clientId: string
    ) {
        return identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // The SDK credential is what selects this arm — not where
                    // the id sits in the request. See
                    // `resolveEnsureAnonymousId`.
                    "x-wallet-sdk-auth": "valid-sdk-jwt",
                    "x-frak-client-id": clientId,
                },
                body: JSON.stringify(body),
            })
        );
    }

    it("rejects with no proof at all", async () => {
        walletAuthed();

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID },
            "anon-sdk"
        );

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.code).toBe("PROOF_REQUIRED");
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("rejects an invalid proof", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID, proof: "bogus-proof" },
            "anon-sdk"
        );

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.code).toBe("PROOF_INVALID");
        expect(mockProofVerify).toHaveBeenCalledWith(
            expect.objectContaining({
                op: "frak-ensure-v1",
                proof: "bogus-proof",
                merchantId: MERCHANT_ID,
                anonymousId: "anon-sdk",
            })
        );
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("accepts a valid proof", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({ valid: true });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID, proof: "valid-proof" },
            "anon-sdk"
        );

        expect(response.status).toBe(200);
        expect(mockResolveAndAssociate).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET_ADDRESS },
            {
                type: "anonymous_fingerprint",
                value: "anon-sdk",
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("an SDK caller cannot dodge the proof by moving its id into the body", async () => {
        // The arm is chosen by the credential, not by where the id sits. If
        // routing were based on field placement, an SDK caller could skip
        // its mandatory proof just by also sending a body `anonymousId` and
        // landing on the permissive wallet arm.
        walletAuthed();

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID, anonymousId: "anon-body" },
            "anon-header"
        );

        expect(response.status).toBe(403);
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });
});
