import { eventEmitter } from "@backend-infrastructure";
import { CryptoHasher } from "bun";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productsApi } from "../../../src/api/external/products";
import { dbMock, interactionDiamondRepositoryMocks } from "../../mock/common";

describe("External Interactions API", () => {
    const mockProductId = "0x01";
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const mockDiamondAddress = "0xdiamond1234567890123456789012345678901234";
    const mockHookSignatureKey = "test-secret-key";

    // Helper function to generate valid HMAC signature
    function generateHmac(body: string, secret: string): string {
        const hasher = new CryptoHasher("sha256", secret);
        hasher.update(body);
        return hasher.digest("base64");
    }

    // Helper function to add backendTrackerTable mock
    function mockBackendTracker(tracker: any) {
        (dbMock.query.backendTrackerTable.findFirst as any).mockResolvedValue(
            tracker
        );
    }

    beforeEach(() => {
        // Reset all mocks before each test
        dbMock.__reset();
        interactionDiamondRepositoryMocks.getDiamondContract.mockClear();
        (eventEmitter.emit as any).mockClear();
        // Reset backendTrackerTable mock
        (dbMock.query.backendTrackerTable.findFirst as any).mockClear();
    });

    describe("POST /products/:productId/webhook/interactions/push", () => {
        it("should push interaction successfully with valid HMAC and data", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
                signature: "0x987654321",
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(
                dbMock.query.backendTrackerTable.findFirst
            ).toHaveBeenCalled();
            expect(
                interactionDiamondRepositoryMocks.getDiamondContract
            ).toHaveBeenCalledWith(mockProductId);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });

        it("should return 400 when productId is missing", async () => {
            // Arrange: No productId in URL path
            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);

            // Act: Make POST request without productId (invalid URL)
            const response = await productsApi.handle(
                new Request(
                    "http://localhost/products//webhook/interactions/push",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": "some-hmac",
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400 or 404 (route not found)
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it("should return 400 when x-hmac-sha256 header is missing", async () => {
            // Arrange: No HMAC header
            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);

            // Act: Make POST request without HMAC header
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Missing hmac");
        });

        it("should return 400 when body is missing wallet", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            const requestBody = {
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid body");
        });

        it("should return 400 when body is missing interaction", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            const requestBody = {
                wallet: mockWalletAddress,
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid body");
        });

        it("should return 400 when wallet is not a valid address", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            const requestBody = {
                wallet: "not-a-valid-address",
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid body");
        });

        it("should return 404 when product backend tracker not found", async () => {
            // Arrange: Mock no backend tracker found
            mockBackendTracker(undefined);

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Product backend tracker not found");
            expect(
                dbMock.query.backendTrackerTable.findFirst
            ).toHaveBeenCalled();
        });

        it("should log warning when HMAC validation fails but still process request", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const invalidHmac = "invalid-hmac-signature";

            // Act: Make POST request with invalid HMAC
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": invalidHmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: validateBodyHmac logs warning but doesn't throw
            // The request should still succeed since validateBodyHmac only logs
            expect(response.status).toBe(200);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });

        it("should return 400 when diamond contract not found", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock no diamond contract found
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                null as never
            );

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("No diamond found for the product");
            expect(
                interactionDiamondRepositoryMocks.getDiamondContract
            ).toHaveBeenCalledWith(mockProductId);
        });

        it("should emit newInteractions event after successful insert", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Event should be emitted
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
            expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
        });

        it("should handle interaction without signature field", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
                // No signature field
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should succeed without signature
            expect(response.status).toBe(200);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });

        it("should handle interaction with null signature", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
                signature: null,
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Should succeed with null signature
            expect(response.status).toBe(200);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });

        it("should return 422 when productId is not a valid hex", async () => {
            // Arrange: Invalid hex productId
            const invalidProductId = "not-a-hex";
            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);

            // Act: Make POST request with invalid hex
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${invalidProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": "some-hmac",
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should handle malformed JSON in body", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            const malformedBody = "{invalid json}";
            const hmac = generateHmac(malformedBody, mockHookSignatureKey);

            // Act: Make POST request with malformed JSON
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: malformedBody,
                    }
                )
            );

            // Assert: Should return 500 (internal error from JSON.parse)
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it("should verify saveInteractions decorator inserts data correctly", async () => {
            // Arrange: Mock backend tracker exists
            const mockTracker = {
                id: "tracker-id",
                productId: mockProductId,
                hookSignatureKey: mockHookSignatureKey,
            };
            mockBackendTracker(mockTracker);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Spy on db.insert to verify saveInteractions is working
            const insertValuesSpy = vi.fn(() => ({
                onConflictDoNothing: vi.fn(() => Promise.resolve([])),
            }));
            const insertSpy = vi.fn(() => ({
                values: insertValuesSpy,
            }));
            dbMock.insert = insertSpy as any;

            const requestBody = {
                wallet: mockWalletAddress,
                interaction: {
                    handlerTypeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                },
            };
            const rawBody = JSON.stringify(requestBody);
            const hmac = generateHmac(rawBody, mockHookSignatureKey);

            // Act: Make POST request
            const response = await productsApi.handle(
                new Request(
                    `http://localhost/products/${mockProductId}/webhook/interactions/push`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain",
                            "x-hmac-sha256": hmac,
                        },
                        body: rawBody,
                    }
                )
            );

            // Assert: saveInteractions should have been called
            expect(response.status).toBe(200);
            expect(insertSpy).toHaveBeenCalled();
            expect(insertValuesSpy).toHaveBeenCalledWith([
                expect.objectContaining({
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    typeDenominator: "0x01",
                    interactionData: "0xabcd1234",
                    status: "pending",
                }),
            ]);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });
    });
});
