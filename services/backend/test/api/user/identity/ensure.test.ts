import { HttpError } from "@backend-utils";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockVerifyTicket,
    mockProofVerify,
    mockProofVerifyOrThrow,
    mockResolveAndAssociate,
    mockWalletVerify,
    mockFindNodeByIdentity,
    mockMarkProofSeen,
} = vi.hoisted(() => ({
    mockVerifyTicket: vi.fn(),
    mockProofVerify: vi.fn(),
    mockProofVerifyOrThrow: vi.fn(),
    mockResolveAndAssociate: vi.fn(),
    mockWalletVerify: vi.fn(),
    mockFindNodeByIdentity: vi.fn(),
    mockMarkProofSeen: vi.fn(),
}));

vi.mock("../../../../src/domain/identity", () => ({
    IdentityContext: {
        repositories: {
            identity: {
                findNodeByIdentity: mockFindNodeByIdentity,
                markProofSeen: mockMarkProofSeen,
            },
        },
        services: {
            installCode: {
                verifyTicket: mockVerifyTicket,
            },
            identityProof: {
                verify: mockProofVerify,
                verifyOrThrow: mockProofVerifyOrThrow,
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
 * `ensure.ts`'s local `headers` schema replaces (rather than merges with)
 * the real `sessionContext` plugin's schema, so the real
 * `withWalletOrSdkAuthent` macro never sees the wallet-auth headers here
 * and always 401s — pre-existing, out of scope. Worked around by reading
 * the auth header off `request` directly, same as `ensure.ts` already does
 * for `x-frak-client-id`.
 */
const { mockInfraMetrics } = vi.hoisted(() => ({
    mockInfraMetrics: {
        identityEnsureArm: vi.fn(),
        identityProofChecked: vi.fn(),
    },
}));

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
                    // Mirrors the real macro, including the fall-through to
                    // the SDK token when a wallet token is present but fails
                    // verification, and the `walletSessionKind` it reports so
                    // `ensure.ts` can tell the SDK arm from the wallet arm.
                    const walletAuth = request.headers.get("x-wallet-auth");
                    if (walletAuth) {
                        const session = await mockWalletVerify(walletAuth);
                        if (session)
                            return {
                                walletSession: session,
                                walletSessionKind: "wallet",
                            };
                    }
                    const sdkAuth = request.headers.get("x-wallet-sdk-auth");
                    if (sdkAuth) {
                        const session = await mockWalletVerify(sdkAuth);
                        if (session)
                            return {
                                walletSession: session,
                                walletSessionKind: "sdk",
                            };
                    }
                    throw new UnauthorizedError();
                },
            },
        });

    return {
        log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        rateLimitMiddleware: () => new Elysia({ name: "Mock.rateLimit" }),
        sessionContext: testSessionContext,
        infraMetrics: mockInfraMetrics,
    };
});

import goldenProofs from "@frak-labs/core-sdk/identity/fixtures";
import { identityEnsureRoutes } from "../../../../src/api/user/identity/ensure";
import { IdentityProofService } from "../../../../src/domain/identity/services/IdentityProofService";

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
        mockProofVerifyOrThrow.mockReset();
        // Mirrors the real service: verify, then 403 on failure.
        mockProofVerifyOrThrow.mockImplementation(async (params: unknown) => {
            const result = await mockProofVerify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        });
        mockResolveAndAssociate.mockReset();
        mockWalletVerify.mockReset();
        mockResolveAndAssociate.mockResolvedValue({
            finalGroupId: "group-1",
            merged: true,
        });
    });

    it("refuses both auth headers, a client-id header, and a bare body anonymousId", async () => {
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

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            code: "PROOF_OR_TOKEN_REQUIRED",
        });
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });
});

describe("POST /identity/ensure — resolution order", () => {
    beforeEach(() => {
        mockVerifyTicket.mockReset();
        mockProofVerify.mockReset();
        mockProofVerifyOrThrow.mockReset();
        // Mirrors the real service: verify, then 403 on failure.
        mockProofVerifyOrThrow.mockImplementation(async (params: unknown) => {
            const result = await mockProofVerify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        });
        mockResolveAndAssociate.mockReset();
        mockMarkProofSeen.mockReset();
        mockWalletVerify.mockReset();
        mockResolveAndAssociate.mockResolvedValue({
            finalGroupId: "group-1",
            merged: true,
        });
    });

    it("old shape: bare anonymousId, no ticket, no proof — now refused", async () => {
        walletAuthed();

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-legacy",
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            code: "PROOF_OR_TOKEN_REQUIRED",
        });
        expect(mockVerifyTicket).not.toHaveBeenCalled();
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("proof + anonymousId arm: verifies as frak-install-v1 and rejects an invalid one", async () => {
        // The wallet arm can only ever receive a `frak-install-v1` proof (the
        // `#p=` / Play-referrer / pending-action one) — the wallet has no
        // signing key and can never produce a `frak-ensure-v1` proof.
        // Asserting the op here guards against reverting to that dead check.
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

        // PROOF_INVALID, not the bare arm's PROOF_OR_TOKEN_REQUIRED: refused
        // because verification ran and failed. Falling through to the bare
        // exit would admit a bad proof as though none had been sent.
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            code: "PROOF_INVALID",
        });
        expect(mockVerifyTicket).not.toHaveBeenCalled();
        expect(mockProofVerify).toHaveBeenCalledWith(
            expect.objectContaining({
                op: "frak-install-v1",
                proof: "some-proof",
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            })
        );
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
        // Never latch on a failed proof — `markProofSeen` never clears.
        expect(mockMarkProofSeen).not.toHaveBeenCalled();
    });

    it("proof + anonymousId arm: accepts a valid frak-install-v1 proof", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({ valid: true });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-2",
            proof: "good-proof",
        });

        expect(response.status).toBe(200);
        expect(mockProofVerify).toHaveBeenCalledWith(
            expect.objectContaining({
                op: "frak-install-v1",
                anonymousId: "anon-2",
            })
        );
        expect(mockResolveAndAssociate).toHaveBeenCalled();
        // The deep-link / Play-referrer install latches here: it reaches
        // ensure directly and never touches `install-code/generate`.
        expect(mockMarkProofSeen).toHaveBeenCalledWith({
            type: "anonymous_fingerprint",
            value: "anon-2",
            merchantId: MERCHANT_ID,
        });
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

    it("rejects a body id minting into the server-minted namespace", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue(null);

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "frakmint_stolen",
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("RESERVED_IDENTITY");
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("accepts a proven body id naming an existing server-minted node", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: null });
        mockProofVerify.mockResolvedValue({ valid: true });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "frakmint_materialised",
            proof: "a-valid-proof",
        });

        expect(response.status).toBe(200);
        expect(mockResolveAndAssociate).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET_ADDRESS },
            {
                type: "anonymous_fingerprint",
                value: "frakmint_materialised",
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("never checks the namespace on the ticket arm", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            merchantId: MERCHANT_ID,
            anonymousId: "frakmint_from_ticket",
        });
        mockFindNodeByIdentity.mockResolvedValue(null);

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            ticket: "valid-ticket",
        });

        expect(response.status).toBe(200);
        expect(mockFindNodeByIdentity).not.toHaveBeenCalled();
    });

    it("routes a header-only wallet caller into the wallet arm and guards it", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue(null);

        const response = await identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-auth": "valid-wallet-jwt",
                    "x-frak-client-id": "frakmint_stolen",
                },
                body: JSON.stringify({ merchantId: MERCHANT_ID }),
            })
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("RESERVED_IDENTITY");
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
 * SDK arm — anonymousId arrives ONLY via the `x-frak-client-id` header.
 * LATCH-GATED: a valid proof, when present, is verified; when absent, the
 * id is allowed unless it has previously latched (mirrors
 * `AnonymousMergeOrchestrator.enforceProof`). The wallet arm (body
 * `anonymousId` or `ticket`, covered above) stays untouched and permissive.
 */
describe("POST /identity/ensure — SDK arm (x-frak-client-id header): latch-gated", () => {
    beforeEach(() => {
        mockVerifyTicket.mockReset();
        mockProofVerify.mockReset();
        mockProofVerifyOrThrow.mockReset();
        // Mirrors the real service: verify, then 403 on failure.
        mockProofVerifyOrThrow.mockImplementation(async (params: unknown) => {
            const result = await mockProofVerify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        });
        mockResolveAndAssociate.mockReset();
        mockWalletVerify.mockReset();
        mockFindNodeByIdentity.mockReset();
        mockMarkProofSeen.mockReset();
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

    it("rejects a header id minting into the server-minted namespace", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue(null);

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID },
            "frakmint_stolen"
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe("RESERVED_IDENTITY");
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("accepts a proven header id naming an existing server-minted node", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: null });
        mockProofVerify.mockResolvedValue({ valid: true });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID, proof: "a-valid-proof" },
            "frakmint_materialised"
        );

        expect(response.status).toBe(200);
        expect(mockResolveAndAssociate).toHaveBeenCalled();
    });

    it("refuses an unlatched id with no proof at all", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: null });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID },
            "anon-sdk"
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            code: "PROOF_REQUIRED",
        });
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
        // No proof was presented, so the latch must NOT be written — that
        // would permanently lock this id out of ever ensuring again.
        expect(mockMarkProofSeen).not.toHaveBeenCalled();
    });

    it("rejects a LATCHED id with no proof", async () => {
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue({
            proofSeenAt: new Date(),
        });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID },
            "anon-sdk"
        );

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.code).toBe("PROOF_REQUIRED");
        expect(mockProofVerify).not.toHaveBeenCalled();
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
        expect(mockMarkProofSeen).not.toHaveBeenCalled();
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

    it("accepts a valid proof and latches the id", async () => {
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
        expect(mockMarkProofSeen).toHaveBeenCalledWith({
            type: "anonymous_fingerprint",
            value: "anon-sdk",
            merchantId: MERCHANT_ID,
        });
    });

    it("a latched id presenting a proof that fails verification still rejects", async () => {
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
        // Proof present → verified directly; the latch is never consulted on
        // this path, matching `enforceProof`'s "latch read happens ONLY on
        // the proof-absent path" invariant.
        expect(mockFindNodeByIdentity).not.toHaveBeenCalled();
        expect(mockMarkProofSeen).not.toHaveBeenCalled();
    });

    it("an SDK caller cannot dodge the arm by moving its id into the body", async () => {
        // The arm is chosen by the credential, not by where the id sits. If
        // routing were based on field placement, an SDK caller with a
        // LATCHED id could dodge its proof requirement just by also sending
        // a body `anonymousId` and landing on the permissive wallet arm.
        walletAuthed();
        mockFindNodeByIdentity.mockResolvedValue({
            proofSeenAt: new Date(),
        });

        const response = await postEnsureViaHeader(
            { merchantId: MERCHANT_ID, anonymousId: "anon-body" },
            "anon-header"
        );

        expect(response.status).toBe(403);
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("an SDK caller cannot dodge the arm with an unverifiable wallet token", async () => {
        // `withWalletOrSdkAuthent` falls through to the SDK token when a
        // wallet token is present but fails verification, so header presence
        // alone must never pick the arm: a valid SDK token paired with a
        // garbage `x-wallet-auth` would otherwise land on the permissive
        // wallet arm and bypass the latch on someone else's proven id.
        mockWalletVerify.mockResolvedValueOnce(undefined);
        mockWalletVerify.mockResolvedValueOnce({ address: WALLET_ADDRESS });
        mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: new Date() });

        const response = await identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-auth": "garbage-wallet-jwt",
                    "x-wallet-sdk-auth": "valid-sdk-jwt",
                },
                body: JSON.stringify({
                    merchantId: MERCHANT_ID,
                    anonymousId: "victim-latched-id",
                }),
            })
        );

        expect(response.status).toBe(403);
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });
});

/**
 * The wallet arm's proof check against the REAL `IdentityProofService` and
 * the shared golden fixture — not the mocked `verify`/`verifyOrThrow` used
 * elsewhere in this file. Regression guard: the wallet arm must verify a
 * `frak-install-v1` proof, not the `frak-ensure-v1` op it used to (and
 * could never satisfy, since the wallet holds no signing key for that op).
 */
describe("POST /identity/ensure — wallet arm verifies against the real IdentityProofService", () => {
    const installFixture = goldenProofs.fixtures.find(
        (f) => f.op === "frak-install-v1"
    );
    if (!installFixture) {
        throw new Error("fixture set must cover frak-install-v1");
    }

    beforeEach(() => {
        mockWalletVerify.mockReset();
        mockResolveAndAssociate.mockReset();
        mockResolveAndAssociate.mockResolvedValue({
            finalGroupId: "group-1",
            merged: true,
        });

        // Delegate the mocked service boundary to a REAL IdentityProofService
        // instance so this test exercises actual WebCrypto verification
        // against the golden fixture, not a hand-rolled mock.
        const realService = new IdentityProofService();
        mockProofVerify.mockImplementation((params: unknown) =>
            realService.verify(
                params as Parameters<IdentityProofService["verify"]>[0]
            )
        );
        vi.setSystemTime(installFixture.ts * 1000);
    });

    it("accepts the golden frak-install-v1 proof on the wallet arm", async () => {
        walletAuthed();

        const response = await postEnsure({
            merchantId: installFixture.merchantId,
            anonymousId: installFixture.anonymousId,
            proof: installFixture.proof,
        });

        expect(response.status).toBe(200);
        expect(mockResolveAndAssociate).toHaveBeenCalled();
    });
});

describe("POST /identity/ensure — mandatory credential", () => {
    beforeEach(() => {
        mockVerifyTicket.mockReset();
        mockProofVerify.mockReset();
        mockProofVerifyOrThrow.mockReset();
        mockProofVerifyOrThrow.mockImplementation(async (params: unknown) => {
            const result = await mockProofVerify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        });
        mockResolveAndAssociate.mockReset();
        mockWalletVerify.mockReset();
        mockFindNodeByIdentity.mockReset();
        mockMarkProofSeen.mockReset();
        mockResolveAndAssociate.mockResolvedValue({
            finalGroupId: "group-1",
            merged: true,
        });
    });

    async function postViaHeaderOnly(clientId: string) {
        return identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-auth": "valid-wallet-jwt",
                    "x-frak-client-id": clientId,
                },
                body: JSON.stringify({ merchantId: MERCHANT_ID }),
            })
        );
    }

    it("refuses the bare wallet arm", async () => {
        walletAuthed();

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-bare",
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            code: "PROOF_OR_TOKEN_REQUIRED",
        });
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("closes the header fall-through by the same exit", async () => {
        walletAuthed();

        const response = await postViaHeaderOnly("anon-from-header");

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            code: "PROOF_OR_TOKEN_REQUIRED",
        });
    });

    it("leaves the ticket branch untouched", async () => {
        walletAuthed();
        mockVerifyTicket.mockResolvedValue({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-from-ticket",
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            ticket: "a-valid-ticket",
        });

        expect(response.status).toBe(200);
        expect(mockResolveAndAssociate).toHaveBeenCalled();
    });

    it("keeps admitting a valid install proof", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({ valid: true });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-proven",
            proof: "a-valid-proof",
        });

        expect(response.status).toBe(200);
        expect(mockMarkProofSeen).toHaveBeenCalled();
    });

    it("refuses an invalid install proof rather than falling through to bare", async () => {
        walletAuthed();
        mockProofVerify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });

        const response = await postEnsure({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-bad-proof",
            proof: "a-bad-proof",
        });

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: "PROOF_INVALID" });
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("refuses a proofless SDK caller", async () => {
        mockWalletVerify.mockResolvedValueOnce({ address: WALLET_ADDRESS });
        mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: null });

        const response = await identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-sdk-auth": "valid-sdk-jwt",
                    "x-frak-client-id": "sdk-anon",
                },
                body: JSON.stringify({ merchantId: MERCHANT_ID }),
            })
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            code: "PROOF_REQUIRED",
        });
        expect(mockResolveAndAssociate).not.toHaveBeenCalled();
    });

    it("403s an invalid SDK proof as PROOF_INVALID, having verified it", async () => {
        mockWalletVerify.mockResolvedValueOnce({ address: WALLET_ADDRESS });
        mockProofVerify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });
        mockProofVerifyOrThrow.mockImplementation(async (params: unknown) => {
            const result = await mockProofVerify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        });

        const response = await identityEnsureRoutes.handle(
            new Request("http://localhost/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-sdk-auth": "valid-sdk-jwt",
                    "x-frak-client-id": "sdk-anon",
                },
                body: JSON.stringify({
                    merchantId: MERCHANT_ID,
                    proof: "a-bad-proof",
                }),
            })
        );

        expect(response.status).toBe(403);
        // Refused because verification RAN and failed — a different
        // population from the proofless one above.
        expect(mockProofVerify).toHaveBeenCalled();
    });
});
