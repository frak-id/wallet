import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../src/utils/httpError";
import { JwtContextMock } from "../../../mock/common";

// Mock the OrchestrationContext using vi.hoisted for proper hoisting
const { mockInitiateMerge, mockExecuteMerge } = vi.hoisted(() => ({
    mockInitiateMerge: vi.fn(),
    mockExecuteMerge: vi.fn(),
}));

vi.mock("../../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            anonymousMerge: {
                initiateMerge: mockInitiateMerge,
                executeMerge: mockExecuteMerge,
            },
        },
    },
}));

import { identityMergeRoutes } from "../../../../src/api/user/identity/merge";

describe("Identity Merge Routes API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        mockInitiateMerge.mockReset();
        mockExecuteMerge.mockReset();
        JwtContextMock.anonymousMerge.sign.mockClear();
        JwtContextMock.anonymousMerge.verify.mockClear();
    });

    describe("POST /identity/merge/initiate", () => {
        it("should return merge token when source identity exists", async () => {
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            mockInitiateMerge.mockResolvedValue({
                success: true,
                mergeToken: "mock-merge-token",
                expiresAt,
            });

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/initiate", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sourceAnonymousId: "fingerprint-abc123",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                mergeToken: "mock-merge-token",
                expiresAt: expiresAt.toISOString(),
            });
            expect(mockInitiateMerge).toHaveBeenCalledWith({
                sourceAnonymousId: "fingerprint-abc123",
                merchantId: "550e8400-e29b-41d4-a716-446655440000",
            });
        });

        it("should accept wallet auth without sourceAnonymousId", async () => {
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            mockInitiateMerge.mockResolvedValue({
                success: true,
                mergeToken: "wallet-merge-token",
                expiresAt,
            });
            JwtContextMock.wallet.verify.mockResolvedValueOnce({
                address: "0xWalletAddress",
            } as never);

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/initiate", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": "valid-wallet-jwt",
                    },
                    body: JSON.stringify({
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.mergeToken).toBe("wallet-merge-token");
            expect(mockInitiateMerge).toHaveBeenCalledWith({
                sourceAnonymousId: undefined,
                sourceWalletAddress: "0xWalletAddress",
                merchantId: "550e8400-e29b-41d4-a716-446655440000",
            });
        });

        it("should return 400 when neither wallet auth nor sourceAnonymousId is provided", async () => {
            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/initiate", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe("MISSING_SOURCE_IDENTITY");
            expect(mockInitiateMerge).not.toHaveBeenCalled();
        });

        it("should return 400 when source identity not found", async () => {
            mockInitiateMerge.mockRejectedValue(
                HttpError.notFound(
                    "SOURCE_NOT_FOUND",
                    "Source anonymous identity not found"
                )
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/initiate", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sourceAnonymousId: "nonexistent-fingerprint",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data).toEqual({
                success: false,
                error: "Source anonymous identity not found",
                code: "SOURCE_NOT_FOUND",
            });
        });
    });

    describe("POST /identity/merge/execute", () => {
        it("should merge groups successfully", async () => {
            mockExecuteMerge.mockResolvedValue({
                finalGroupId: "770e8400-e29b-41d4-a716-446655440000",
                merged: true,
            });

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "valid-merge-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                finalGroupId: "770e8400-e29b-41d4-a716-446655440000",
                merged: true,
            });
        });

        it("should return merged=false when groups are already the same", async () => {
            mockExecuteMerge.mockResolvedValue({
                finalGroupId: "770e8400-e29b-41d4-a716-446655440000",
                merged: false,
            });

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "valid-merge-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.merged).toBe(false);
        });

        it("should return 401 when token is invalid", async () => {
            mockExecuteMerge.mockRejectedValue(
                HttpError.unauthorized(
                    "TOKEN_INVALID",
                    "Invalid or expired merge token"
                )
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "invalid-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.code).toBe("TOKEN_INVALID");
        });

        it("should return 401 when token is expired", async () => {
            mockExecuteMerge.mockRejectedValue(
                HttpError.unauthorized("TOKEN_EXPIRED", "Token has expired")
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "expired-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.code).toBe("TOKEN_EXPIRED");
        });

        it("should return 400 when target identity not found", async () => {
            mockExecuteMerge.mockRejectedValue(
                HttpError.notFound(
                    "TARGET_NOT_FOUND",
                    "Target anonymous identity not found"
                )
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "valid-merge-token",
                        targetAnonymousId: "nonexistent-fingerprint",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.code).toBe("TARGET_NOT_FOUND");
        });

        it("should return 400 when merchant mismatch", async () => {
            mockExecuteMerge.mockRejectedValue(
                HttpError.badRequest(
                    "MERCHANT_MISMATCH",
                    "Token merchant does not match request"
                )
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "valid-merge-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "660e8400-e29b-41d4-a716-446655440000", // Different but valid UUID
                    }),
                })
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe("MERCHANT_MISMATCH");
        });

        it("should return 400 when wallet conflict", async () => {
            mockExecuteMerge.mockRejectedValue(
                HttpError.conflict(
                    "WALLET_CONFLICT",
                    "Cannot merge identities linked to different wallets"
                )
            );

            const response = await identityMergeRoutes.handle(
                new Request("http://localhost/merge/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        mergeToken: "valid-merge-token",
                        targetAnonymousId: "fingerprint-xyz789",
                        merchantId: "550e8400-e29b-41d4-a716-446655440000",
                    }),
                })
            );

            expect(response.status).toBe(409);
            const data = await response.json();
            expect(data.code).toBe("WALLET_CONFLICT");
        });
    });
});
