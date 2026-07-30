import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockGenerate,
    mockResolve,
    mockMintTicket,
    mockProofVerify,
    mockFindGroupByIdentity,
    mockGetWalletForGroup,
    mockFindMerchantById,
} = vi.hoisted(() => ({
    mockGenerate: vi.fn(),
    mockResolve: vi.fn(),
    mockMintTicket: vi.fn(),
    mockProofVerify: vi.fn(),
    mockFindGroupByIdentity: vi.fn(),
    mockGetWalletForGroup: vi.fn(),
    mockFindMerchantById: vi.fn(),
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
                getWalletForGroup: mockGetWalletForGroup,
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

import { installCodeRoutes } from "../../../../src/api/user/identity/installCode";

const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("Install Code Routes API", () => {
    beforeEach(() => {
        mockGenerate.mockReset();
        mockResolve.mockReset();
        mockMintTicket.mockReset();
        mockProofVerify.mockReset();
        mockFindGroupByIdentity.mockReset();
        mockGetWalletForGroup.mockReset();
        mockFindMerchantById.mockReset();
    });

    describe("POST /install-code/generate", () => {
        it("generates a code from the old shape (no proof)", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });

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

            expect(response.status).toBe(200);
            expect(mockProofVerify).not.toHaveBeenCalled();
            expect(mockGenerate).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
            });
        });

        it("verifies and observes a proof without gating generation on it", async () => {
            const expiresAt = new Date(Date.now() + 60_000);
            mockGenerate.mockResolvedValue({ code: "ABC123", expiresAt });
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

            // Accept-and-observe: an invalid proof still yields a 200 and a
            // generated code — `generate` gates nothing yet.
            expect(response.status).toBe(200);
            expect(mockProofVerify).toHaveBeenCalledWith(
                expect.objectContaining({
                    op: "frak-install-v1",
                    proof: "some-proof",
                    merchantId: MERCHANT_ID,
                    anonymousId: "anon-1",
                })
            );
            expect(mockGenerate).toHaveBeenCalledWith({
                merchantId: MERCHANT_ID,
                anonymousId: "anon-1",
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
    });
});
