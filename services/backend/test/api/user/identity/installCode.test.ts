import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../src/utils/httpError";

const {
    mockGenerate,
    mockResolve,
    mockMintTicket,
    mockProofVerify,
    mockMarkProofSeen,
    mockFindGroupByIdentity,
    mockGetWalletForGroup,
    mockFindMerchantById,
    mockResolveForGenerate,
    mockResolveDeferred,
    mockFindNodeByIdentity,
} = vi.hoisted(() => ({
    mockGenerate: vi.fn(),
    mockResolve: vi.fn(),
    mockMintTicket: vi.fn(),
    mockProofVerify: vi.fn(),
    mockMarkProofSeen: vi.fn(),
    mockFindGroupByIdentity: vi.fn(),
    mockGetWalletForGroup: vi.fn(),
    mockFindMerchantById: vi.fn(),
    mockResolveForGenerate: vi.fn(),
    mockResolveDeferred: vi.fn(),
    mockFindNodeByIdentity: vi.fn(),
}));

vi.mock("../../../../src/domain/identity/context", () => ({
    IdentityContext: {
        services: {
            installCode: {
                generate: mockGenerate,
                resolve: mockResolve,
                mintTicket: mockMintTicket,
            },
            identityProof: {
                verify: mockProofVerify,
            },
        },
        repositories: {
            identity: {
                findGroupByIdentity: mockFindGroupByIdentity,
                findNodeByIdentity: mockFindNodeByIdentity,
                getWalletForGroup: mockGetWalletForGroup,
                markProofSeen: mockMarkProofSeen,
            },
        },
    },
}));

vi.mock("../../../../src/domain/merchant/context", () => ({
    MerchantContext: {
        repositories: {
            merchant: {
                findById: mockFindMerchantById,
            },
        },
    },
}));

vi.mock("../../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            installCredential: {
                resolveForGenerate: mockResolveForGenerate,
                resolveDeferred: mockResolveDeferred,
            },
        },
    },
}));

const { mockInfraMetrics } = vi.hoisted(() => ({
    mockInfraMetrics: {
        identityInstallCodeGenerateCredential: vi.fn(),
    },
}));

vi.mock("@backend-infrastructure", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@backend-infrastructure")>()),
    infraMetrics: mockInfraMetrics,
}));

import { installCodeRoutes } from "../../../../src/api/user/identity/installCode";

const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("Install Code Routes API", () => {
    beforeEach(() => {
        mockGenerate.mockReset();
        mockResolve.mockReset();
        mockMintTicket.mockReset();
        mockProofVerify.mockReset();
        mockMarkProofSeen.mockReset();
        mockFindGroupByIdentity.mockReset();
        mockGetWalletForGroup.mockReset();
        mockFindMerchantById.mockReset();
        mockResolveForGenerate.mockReset();
        mockResolveDeferred.mockReset();
        mockFindNodeByIdentity.mockReset();
    });

    describe("POST /install-code/generate", () => {
        it("refuses the old proofless shape", async () => {
            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "anon-1",
                    }),
                })
            );

            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({
                code: "PROOF_REQUIRED",
            });
            expect(mockMarkProofSeen).not.toHaveBeenCalled();
            expect(mockGenerate).not.toHaveBeenCalled();
        });

        it("refuses an invalid proof, having actually verified it", async () => {
            mockProofVerify.mockResolvedValue({
                valid: false,
                reason: "bad_signature",
            });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "anon-1",
                        proof: "some-proof",
                    }),
                })
            );

            // PROOF_INVALID, not PROOF_REQUIRED: refused because verification
            // ran and failed, which is a different population from no proof.
            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({
                code: "PROOF_INVALID",
            });
            expect(mockProofVerify).toHaveBeenCalledWith(
                expect.objectContaining({
                    op: "frak-install-v1",
                    proof: "some-proof",
                    merchantId: MERCHANT_ID,
                    anonymousId: "anon-1",
                })
            );
            expect(mockGenerate).not.toHaveBeenCalled();
            // Never latch on a failed proof — `markProofSeen` never clears.
            expect(mockMarkProofSeen).not.toHaveBeenCalled();
        });

        it("latches proof_seen_at on the identity node for a valid proof", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });
            mockProofVerify.mockResolvedValue({ valid: true });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "anon-1",
                        proof: "some-proof",
                    }),
                })
            );

            expect(response.status).toBe(200);
            // The code path's only latch point: its later ensure carries a
            // ticket and no proof.
            expect(mockMarkProofSeen).toHaveBeenCalledWith({
                type: "anonymous_fingerprint",
                value: "anon-1",
                merchantId: MERCHANT_ID,
            });
        });

        it("rejects a body carrying both credentials", async () => {
            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "anon-1",
                        checkoutToken: "tok-1",
                    }),
                })
            );

            expect(response.status).toBe(400);
            expect(mockGenerate).not.toHaveBeenCalled();
            expect(mockResolveForGenerate).not.toHaveBeenCalled();
        });

        it("mints against the resolved id for a checkout token", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });
            mockResolveForGenerate.mockResolvedValue({
                outcome: "resolved",
                anonymousId: "anon-resolved",
            });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        checkoutToken: "tok-1",
                    }),
                })
            );

            expect(response.status).toBe(200);
            expect(mockGenerate).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                credential: {
                    kind: "checkoutToken",
                    checkoutToken: "tok-1",
                    anonymousId: "anon-resolved",
                },
            });
        });

        it("still generates a code when the webhook never arrives", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });
            mockResolveForGenerate.mockResolvedValue({ outcome: "deferred" });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        checkoutToken: "tok-1",
                    }),
                })
            );

            expect(response.status).toBe(200);
            expect(mockGenerate).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                credential: {
                    kind: "checkoutToken",
                    checkoutToken: "tok-1",
                    anonymousId: null,
                },
            });
        });

        it("404s as not-configured when the merchant has no webhook", async () => {
            mockResolveForGenerate.mockResolvedValue({ outcome: "unresolved" });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        checkoutToken: "tok-1",
                    }),
                })
            );

            expect(response.status).toBe(404);
            expect(await response.json()).toEqual({
                success: false,
                error: "Merchant has no purchase webhook configured",
                code: "MERCHANT_NOT_CONFIGURED",
            });
            expect(mockGenerate).not.toHaveBeenCalled();
        });

        it("400s on a body carrying neither credential", async () => {
            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ merchantId: MERCHANT_ID }),
                })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "MISSING_CREDENTIAL",
            });
            expect(mockGenerate).not.toHaveBeenCalled();
        });

        it("400s on a caller-named id minting into the server-minted namespace", async () => {
            mockFindNodeByIdentity.mockResolvedValue(null);

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "frakmint_stolen",
                    }),
                })
            );

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "RESERVED_IDENTITY",
            });
            expect(mockGenerate).not.toHaveBeenCalled();
        });

        it("mints for a proven id naming an existing server-minted node", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockFindNodeByIdentity.mockResolvedValue({ proofSeenAt: null });
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });
            mockProofVerify.mockResolvedValue({ valid: true });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId: MERCHANT_ID,
                        anonymousId: "frakmint_materialised",
                        proof: "a-valid-proof",
                    }),
                })
            );

            expect(response.status).toBe(200);
            expect(mockGenerate).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                credential: {
                    kind: "anonymous",
                    anonymousId: "frakmint_materialised",
                },
            });
        });
    });

    describe("POST /install-code/resolve", () => {
        it("returns the existing fields unchanged, plus a new ticket", async () => {
            mockResolve.mockResolvedValue({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            });
            mockFindMerchantById.mockResolvedValue({
                name: "Acme",
                domain: "acme.com",
            });
            mockFindGroupByIdentity.mockResolvedValue(null);
            mockMintTicket.mockResolvedValue("minted-ticket");

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "ABC123" }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
                merchant: { name: "Acme", domain: "acme.com" },
                hasWallet: false,
                ticket: "minted-ticket",
            });
            expect(mockMintTicket).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            });
        });

        it("mints a ticket regardless of hasWallet", async () => {
            mockResolve.mockResolvedValue({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            });
            mockFindMerchantById.mockResolvedValue({
                name: "Acme",
                domain: "acme.com",
            });
            mockFindGroupByIdentity.mockResolvedValue({ id: "group-1" });
            mockGetWalletForGroup.mockResolvedValue("0xWallet");
            mockMintTicket.mockResolvedValue("minted-ticket");

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "ABC123" }),
                })
            );

            const data = await response.json();
            expect(data.hasWallet).toBe(true);
            expect(data.ticket).toBe("minted-ticket");
        });

        it("returns 404 when the code is expired, unknown, or attempt-exhausted", async () => {
            mockResolve.mockRejectedValue(
                HttpError.notFound(
                    "CODE_NOT_FOUND",
                    "Invalid or expired install code"
                )
            );

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "ABC123" }),
                })
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data).toEqual({
                success: false,
                error: "Invalid or expired install code",
                code: "CODE_NOT_FOUND",
            });
            expect(mockMintTicket).not.toHaveBeenCalled();
        });

        it("resolves a deferred row from its stored checkout token", async () => {
            mockResolve.mockResolvedValue({
                merchantId: MERCHANT_ID,
                anonymousId: null,
                checkoutToken: "tok-1",
            });
            mockResolveDeferred.mockResolvedValue({
                anonymousId: "anon-late",
            });
            mockFindMerchantById.mockResolvedValue({
                name: "Acme",
                domain: "acme.com",
            });
            mockFindGroupByIdentity.mockResolvedValue(null);
            mockMintTicket.mockResolvedValue("minted-ticket");

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "ABC123" }),
                })
            );

            expect(response.status).toBe(200);
            expect(mockResolveDeferred).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                checkoutToken: "tok-1",
            });
            expect(await response.json()).toEqual({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-late",
                merchant: { name: "Acme", domain: "acme.com" },
                hasWallet: false,
                ticket: "minted-ticket",
            });
        });

        it("returns UNRESOLVED with no id and no ticket when nothing resolves", async () => {
            mockResolve.mockResolvedValue({
                merchantId: MERCHANT_ID,
                anonymousId: null,
                checkoutToken: "tok-1",
            });
            mockResolveDeferred.mockResolvedValue(null);
            mockFindMerchantById.mockResolvedValue({
                name: "Acme",
                domain: "acme.com",
            });

            const response = await installCodeRoutes.handle(
                new Request("http://localhost/install-code/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "ABC123" }),
                })
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({
                merchantId: MERCHANT_ID,
                merchant: { name: "Acme", domain: "acme.com" },
                hasWallet: false,
                outcome: "UNRESOLVED",
            });
            expect(mockMintTicket).not.toHaveBeenCalled();
        });
    });
});

describe("POST /install-code/generate — mandatory proof", () => {
    beforeEach(() => {
        mockGenerate.mockReset();
        mockProofVerify.mockReset();
        mockMarkProofSeen.mockReset();
        mockResolveForGenerate.mockReset();
        mockFindNodeByIdentity.mockReset();
        mockInfraMetrics.identityInstallCodeGenerateCredential.mockReset();
    });

    async function postGenerate(body: Record<string, unknown>) {
        return installCodeRoutes.handle(
            new Request("http://localhost/install-code/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
        );
    }

    it("refuses a proofless anonymous id", async () => {
        const response = await postGenerate({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-1",
        });

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            code: "PROOF_REQUIRED",
        });
        expect(mockGenerate).not.toHaveBeenCalled();
        expect(
            mockInfraMetrics.identityInstallCodeGenerateCredential
        ).toHaveBeenCalledWith("absent_unlatched");
    });

    it("mints for a valid proof", async () => {
        mockProofVerify.mockResolvedValue({ valid: true });
        mockGenerate.mockResolvedValue({
            code: "ABC123",
            expiresAt: new Date(Date.now() + 60_000),
        });

        const response = await postGenerate({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-1",
            proof: "a-valid-proof",
        });

        expect(response.status).toBe(200);
        expect(mockMarkProofSeen).toHaveBeenCalled();
        expect(
            mockInfraMetrics.identityInstallCodeGenerateCredential
        ).toHaveBeenCalledWith("proven");
    });

    it("refuses an invalid proof as PROOF_INVALID, having verified it", async () => {
        mockProofVerify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });

        const response = await postGenerate({
            merchantId: MERCHANT_ID,
            anonymousId: "anon-1",
            proof: "a-bad-proof",
        });

        expect(response.status).toBe(403);
        // Distinct from PROOF_REQUIRED: a supplied-but-bad proof is a different
        // population from no proof at all, and only verification separates them.
        expect(await response.json()).toMatchObject({
            code: "PROOF_INVALID",
        });
        expect(mockProofVerify).toHaveBeenCalled();
        expect(mockGenerate).not.toHaveBeenCalled();
        expect(
            mockInfraMetrics.identityInstallCodeGenerateCredential
        ).toHaveBeenCalledWith("invalid");
        expect(
            mockInfraMetrics.identityInstallCodeGenerateCredential
        ).not.toHaveBeenCalledWith("absent_unlatched");
    });

    it("mints on the checkout-token arm, which carries no proof", async () => {
        mockResolveForGenerate.mockResolvedValue({
            outcome: "resolved",
            anonymousId: "anon-from-order",
        });
        mockGenerate.mockResolvedValue({
            code: "ABC123",
            expiresAt: new Date(Date.now() + 60_000),
        });

        const response = await postGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok-1",
        });

        // Gate 2 derives its id server-side, so the mandatory-proof rule that
        // guards a caller-presented id must never reach this arm.
        expect(response.status).toBe(200);
        expect(
            mockInfraMetrics.identityInstallCodeGenerateCredential
        ).not.toHaveBeenCalled();
    });

    it("400s a body carrying neither credential", async () => {
        const response = await postGenerate({ merchantId: MERCHANT_ID });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            code: "MISSING_CREDENTIAL",
        });
    });
});
