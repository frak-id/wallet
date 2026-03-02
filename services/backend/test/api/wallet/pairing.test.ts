import { beforeEach, describe, expect, it, vi } from "vitest";
import { managementRoutes } from "../../../src/api/user/wallet/routes/pairing/management";
import { dbMock, JwtContextMock } from "../../mock/common";

describe("Wallet Pairing Management Routes API", () => {
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const validAuthToken = "valid-jwt-token";

    beforeEach(() => {
        // Reset all mocks before each test
        dbMock.__reset();
        JwtContextMock.wallet.verify.mockClear();
        JwtContextMock.wallet.sign.mockClear();

        // Reset query table mocks
        if (dbMock.query.pairingTable) {
            (dbMock.query.pairingTable.findFirst as any).mockClear?.();
            (dbMock.query.pairingTable.findMany as any).mockClear?.();
        }
    });

    describe("GET /find/:id", () => {
        const testPairingId = "pairing-abc-123";

        it("should return pairing when found by ID", async () => {
            // Arrange: Mock database response
            const mockPairing = {
                pairingId: testPairingId,
                originName: "Chrome on Windows",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                pairingCode: "12345678",
                wallet: mockWalletAddress,
                originUserAgent: "Mozilla/5.0",
                targetUserAgent: "Mozilla/5.0",
                targetName: "Safari on iPhone",
                resolvedAt: new Date("2024-01-01T00:01:00Z"),
                lastActiveAt: new Date("2024-01-01T00:02:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request(`http://localhost/find/${testPairingId}`)
            );

            // Assert: Should return 200 with pairing data
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                id: mockPairing.pairingId,
                originName: mockPairing.originName,
                createdAt: mockPairing.createdAt.toISOString(),
                pairingCode: mockPairing.pairingCode,
            });
        });

        it("should return 404 when pairing not found", async () => {
            // Arrange: Mock database returning empty array (null after transformation)
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request(`http://localhost/find/${testPairingId}`)
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Pairing not found");
        });

        it("should include correct fields in response", async () => {
            // Arrange: Mock pairing with all fields
            const mockPairing = {
                pairingId: "test-pairing-456",
                originName: "Firefox on Linux",
                createdAt: new Date("2024-02-15T10:30:00Z"),
                pairingCode: "87654321",
                wallet: mockWalletAddress,
                originUserAgent: "Mozilla/5.0",
                targetUserAgent: null,
                targetName: null,
                resolvedAt: null,
                lastActiveAt: new Date("2024-02-15T10:30:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request("http://localhost/find/test-pairing-456")
            );

            // Assert: Should only include specific fields
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toHaveProperty("id");
            expect(data).toHaveProperty("originName");
            expect(data).toHaveProperty("createdAt");
            expect(data).toHaveProperty("pairingCode");
            expect(data).not.toHaveProperty("wallet");
            expect(data).not.toHaveProperty("targetName");
            expect(data).not.toHaveProperty("resolvedAt");
        });

        it("should handle special characters in pairing ID", async () => {
            // Arrange: Pairing ID with special characters
            const specialPairingId = "pairing-test_123-ABC";
            const mockPairing = {
                pairingId: specialPairingId,
                originName: "Test Device",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                pairingCode: "11111111",
                wallet: null,
                originUserAgent: "Test",
                targetUserAgent: null,
                targetName: null,
                resolvedAt: null,
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make GET request with encoded ID
            const response = await managementRoutes.handle(
                new Request(
                    `http://localhost/find/${encodeURIComponent(specialPairingId)}`
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.id).toBe(specialPairingId);
        });

        it("should not require authentication for find endpoint", async () => {
            // Arrange: Mock pairing
            const mockPairing = {
                pairingId: testPairingId,
                originName: "Device",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                pairingCode: "99999999",
                wallet: null,
                originUserAgent: "Test",
                targetUserAgent: null,
                targetName: null,
                resolvedAt: null,
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make GET request WITHOUT auth header
            const response = await managementRoutes.handle(
                new Request(`http://localhost/find/${testPairingId}`)
            );

            // Assert: Should succeed without authentication
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });
    });

    describe("GET /list", () => {
        it("should return all pairings for authenticated wallet", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairings = [
                {
                    pairingId: "pairing-1",
                    originName: "Chrome on Windows",
                    targetName: "Safari on iPhone",
                    createdAt: new Date("2024-01-01T00:00:00Z"),
                    lastActiveAt: new Date("2024-01-01T01:00:00Z"),
                    wallet: mockWalletAddress,
                },
                {
                    pairingId: "pairing-2",
                    originName: "Firefox on Mac",
                    targetName: "Chrome on Android",
                    createdAt: new Date("2024-01-02T00:00:00Z"),
                    lastActiveAt: new Date("2024-01-02T01:00:00Z"),
                    wallet: mockWalletAddress,
                },
            ];

            dbMock.__setFindManyResponse(() => Promise.resolve(mockPairings));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request("http://localhost/list", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return 200 with pairings list
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                validAuthToken
            );

            const data = await response.json();
            expect(data).toHaveLength(2);
            expect(data[0]).toEqual({
                pairingId: "pairing-1",
                originName: "Chrome on Windows",
                targetName: "Safari on iPhone",
                createdAt: mockPairings[0].createdAt.toISOString(),
                lastActiveAt: mockPairings[0].lastActiveAt.toISOString(),
            });
            expect(data[1]).toEqual({
                pairingId: "pairing-2",
                originName: "Firefox on Mac",
                targetName: "Chrome on Android",
                createdAt: mockPairings[1].createdAt.toISOString(),
                lastActiveAt: mockPairings[1].lastActiveAt.toISOString(),
            });
        });

        it("should return empty array when no pairings exist", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setFindManyResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request("http://localhost/list", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return empty array
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual([]);
        });

        it("should default targetName to 'Unknown' when null", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairings = [
                {
                    pairingId: "pairing-unresolved",
                    originName: "Chrome on Windows",
                    targetName: null,
                    createdAt: new Date("2024-01-01T00:00:00Z"),
                    lastActiveAt: new Date("2024-01-01T00:00:00Z"),
                    wallet: mockWalletAddress,
                },
            ];

            dbMock.__setFindManyResponse(() => Promise.resolve(mockPairings));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request("http://localhost/list", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should default targetName to "Unknown"
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data[0].targetName).toBe("Unknown");
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make GET request without auth header
            const response = await managementRoutes.handle(
                new Request("http://localhost/list")
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make GET request with invalid token
            const response = await managementRoutes.handle(
                new Request("http://localhost/list", {
                    headers: {
                        "x-wallet-auth": "invalid-token",
                    },
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });

        it("should filter pairings by wallet address", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairings = [
                {
                    pairingId: "pairing-owned",
                    originName: "My Device",
                    targetName: "My Phone",
                    createdAt: new Date("2024-01-01T00:00:00Z"),
                    lastActiveAt: new Date("2024-01-01T00:00:00Z"),
                    wallet: mockWalletAddress,
                },
            ];

            dbMock.__setFindManyResponse(() => Promise.resolve(mockPairings));

            // Act: Make GET request
            const response = await managementRoutes.handle(
                new Request("http://localhost/list", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should only return pairings for this wallet
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toHaveLength(1);
            expect(data[0].pairingId).toBe("pairing-owned");
        });
    });

    describe("POST /:id/delete", () => {
        const testPairingId = "pairing-to-delete";

        it("should successfully delete owned pairing", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairing = {
                pairingId: testPairingId,
                wallet: mockWalletAddress,
                originName: "Device",
                targetName: "Phone",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            // Act: Make POST request to delete
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                validAuthToken
            );
        });

        it("should return 404 when pairing not found", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make POST request to delete
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Pairing not found");
        });

        it("should return 404 when pairing not yet resolved (no wallet)", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairing = {
                pairingId: testPairingId,
                wallet: null, // Not yet resolved
                originName: "Device",
                targetName: null,
                createdAt: new Date("2024-01-01T00:00:00Z"),
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make POST request to delete
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Pairing not yet resolved");
        });

        it("should return 403 when wallet does not own pairing", async () => {
            // Arrange: Mock successful authentication
            const otherWalletAddress =
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairing = {
                pairingId: testPairingId,
                wallet: otherWalletAddress, // Different wallet owns this
                originName: "Device",
                targetName: "Phone",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            // Act: Make POST request to delete
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return 403 Forbidden
            expect(response.status).toBe(403);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Forbidden");
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make POST request without auth header
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make POST request with invalid token
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": "invalid-token",
                    },
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });

        it("should verify delete was called with correct pairing ID", async () => {
            // Arrange: Mock successful authentication and pairing
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const mockPairing = {
                pairingId: testPairingId,
                wallet: mockWalletAddress,
                originName: "Device",
                targetName: "Phone",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                lastActiveAt: new Date("2024-01-01T00:00:00Z"),
            };

            dbMock.__setSelectResponse(() => Promise.resolve([mockPairing]));

            const deleteWhereMock = vi.fn(() => ({
                // biome-ignore lint/suspicious/noThenProperty: Required for promise-like behavior in mocks
                then: (onfulfilled?: (value: unknown) => unknown) => {
                    const promise = Promise.resolve([]);
                    return promise.then(onfulfilled);
                },
            }));

            dbMock.delete = vi.fn(() => ({
                where: deleteWhereMock,
            })) as any;

            // Act: Make POST request to delete
            const response = await managementRoutes.handle(
                new Request(`http://localhost/${testPairingId}/delete`, {
                    method: "POST",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should call delete with where clause
            expect(response.status).toBe(200);
            expect(dbMock.delete).toHaveBeenCalled();
            expect(deleteWhereMock).toHaveBeenCalled();
        });
    });
});
