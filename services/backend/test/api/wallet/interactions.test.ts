import { eventEmitter } from "@backend-infrastructure";
import { beforeEach, describe, expect, it } from "vitest";
import { purchaseInteractionsRoutes } from "../../../src/api/wallet/routes/interactions/purchase";
import { pushInteractionsRoutes } from "../../../src/api/wallet/routes/interactions/push";
import { simulateRoutes } from "../../../src/api/wallet/routes/interactions/simulate";
import {
    campaignRewardsServiceMocks,
    dbMock,
    interactionDiamondRepositoryMocks,
    JwtContextMock,
} from "../../mock/common";

describe("Wallet Interactions Routes API", () => {
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const validAuthToken = "valid-jwt-token";
    const mockProductId = "0x01";
    const mockCampaignAddress = "0xabcdef1234567890123456789012345678901234";
    const mockTokenAddress = "0x9876543210987654321098765432109876543210";

    beforeEach(() => {
        // Reset all mocks before each test
        dbMock.__reset();
        JwtContextMock.wallet.verify.mockClear();
        JwtContextMock.walletSdk.verify.mockClear();
        campaignRewardsServiceMocks.getActiveRewardsForProduct.mockClear();
        interactionDiamondRepositoryMocks.getDiamondContract.mockClear();
        (eventEmitter.emit as any).mockClear();
    });

    describe("GET /estimate (simulate.ts)", () => {
        it("should return active rewards with valid productId", async () => {
            // Arrange: Mock active rewards
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: { baseReward: 15 },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}`
                )
            );

            // Assert: Should return rewards
            expect(response.status).toBe(200);
            expect(
                campaignRewardsServiceMocks.getActiveRewardsForProduct
            ).toHaveBeenCalledWith({
                productId: mockProductId,
            });

            const data = await response.json();
            expect(data).toEqual({
                maxReferrer: {
                    amount: 10,
                    eurAmount: 12,
                    usdAmount: 10,
                    gbpAmount: 8,
                },
                maxReferee: {
                    amount: 5,
                    eurAmount: 6,
                    usdAmount: 5,
                    gbpAmount: 4,
                },
                activeRewards: mockRewards,
                totalReferrerEur: 12,
                totalRefereeEur: 6,
            });
        });

        it("should return null when no active rewards found", async () => {
            // Arrange: Mock no rewards
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                undefined
            );

            // Act: Make GET request
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}`
                )
            );

            // Assert: Should return null (Elysia returns empty body for null)
            expect(response.status).toBe(200);
            const text = await response.text();
            // Elysia returns empty string for null responses
            expect(text).toBe("");
        });

        it("should filter by interactionKey when provided", async () => {
            // Arrange: Mock multiple rewards with different interaction types
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: { baseReward: 15 },
                },
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "purchase",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 20,
                        eurAmount: 24,
                        usdAmount: 20,
                        gbpAmount: 16,
                    },
                    referee: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    triggerData: { baseReward: 30 },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request with interactionKey filter
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}&interactionKey=read-article`
                )
            );

            // Assert: Should return only filtered rewards
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data?.activeRewards).toHaveLength(1);
            expect(data?.activeRewards[0].interactionTypeKey).toBe(
                "read-article"
            );
        });

        it("should return null when filtered rewards are empty", async () => {
            // Arrange: Mock rewards that don't match filter
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: { baseReward: 15 },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request with non-matching filter
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}&interactionKey=purchase`
                )
            );

            // Assert: Should return null (Elysia returns empty body for null)
            expect(response.status).toBe(200);
            const text = await response.text();
            // Elysia returns empty string for null responses
            expect(text).toBe("");
        });

        it("should calculate max referrer correctly with multiple rewards", async () => {
            // Arrange: Mock multiple rewards with different amounts
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: { baseReward: 15 },
                },
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "purchase",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 25,
                        eurAmount: 30,
                        usdAmount: 25,
                        gbpAmount: 20,
                    },
                    referee: {
                        amount: 15,
                        eurAmount: 18,
                        usdAmount: 15,
                        gbpAmount: 12,
                    },
                    triggerData: { baseReward: 40 },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}`
                )
            );

            // Assert: Should return max values
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data?.maxReferrer.amount).toBe(25);
            expect(data?.maxReferee.amount).toBe(15);
        });

        it("should calculate max referee correctly with multiple rewards", async () => {
            // Arrange: Mock rewards where referee amounts vary
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    referee: {
                        amount: 20,
                        eurAmount: 24,
                        usdAmount: 20,
                        gbpAmount: 16,
                    },
                    triggerData: { baseReward: 25 },
                },
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "purchase",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: { baseReward: 15 },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}`
                )
            );

            // Assert: Should return max referee
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data?.maxReferee.amount).toBe(20);
        });

        it("should return 422 when productId is missing", async () => {
            // Act: Make GET request without productId
            const response = await simulateRoutes.handle(
                new Request("http://localhost/estimate")
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(
                campaignRewardsServiceMocks.getActiveRewardsForProduct
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when productId is invalid hex", async () => {
            // Act: Make GET request with invalid hex
            const response = await simulateRoutes.handle(
                new Request("http://localhost/estimate?productId=invalid-hex")
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(
                campaignRewardsServiceMocks.getActiveRewardsForProduct
            ).not.toHaveBeenCalled();
        });

        it("should handle rewards with range trigger data", async () => {
            // Arrange: Mock rewards with range distribution
            const mockRewards = [
                {
                    campaign: mockCampaignAddress,
                    interactionTypeKey: "read-article",
                    token: mockTokenAddress,
                    referrer: {
                        amount: 10,
                        eurAmount: 12,
                        usdAmount: 10,
                        gbpAmount: 8,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 6,
                        usdAmount: 5,
                        gbpAmount: 4,
                    },
                    triggerData: {
                        startReward: 5,
                        endReward: 15,
                        beta: 0.5,
                    },
                },
            ];
            campaignRewardsServiceMocks.getActiveRewardsForProduct.mockResolvedValue(
                mockRewards as never
            );

            // Act: Make GET request
            const response = await simulateRoutes.handle(
                new Request(
                    `http://localhost/estimate?productId=${mockProductId}`
                )
            );

            // Assert: Should return rewards with range trigger data
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data?.activeRewards[0].triggerData).toEqual({
                startReward: 5,
                endReward: 15,
                beta: 0.5,
            });
        });
    });

    describe("POST /push (push.ts)", () => {
        const mockDiamondAddress =
            "0xdiamond1234567890123456789012345678901234";

        it("should push interactions successfully with valid data", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Mock diamond contract exists
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            // Mock successful insert
            dbMock.__setInsertResponse(() =>
                Promise.resolve([{ insertedId: 1n }, { insertedId: 2n }])
            );

            const interactions = [
                {
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x01",
                        interactionData: "0xabcd",
                    },
                    signature: "0x1234567890",
                },
                {
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x02",
                        interactionData: "0xef01",
                    },
                },
            ];

            // Act: Make POST request
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(JwtContextMock.walletSdk.verify).toHaveBeenCalledWith(
                validAuthToken
            );
            expect(
                interactionDiamondRepositoryMocks.getDiamondContract
            ).toHaveBeenCalledWith(mockProductId);
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");

            const data = await response.json();
            expect(data).toEqual(["1", "2"]);
        });

        it("should return empty array when interactions array is empty", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Act: Make POST request with empty array
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions: [] }),
                })
            );

            // Assert: Should return empty array
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual([]);
            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });

        it("should return 403 when wallet address mismatch detected", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const differentWallet =
                "0x9999999999999999999999999999999999999999";
            const interactions = [
                {
                    wallet: differentWallet,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x01",
                        interactionData: "0xabcd",
                    },
                },
            ];

            // Act: Make POST request
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions }),
                })
            );

            // Assert: Should return 403
            expect(response.status).toBe(403);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid wallet address");
        });

        it("should filter out interactions when no diamond found", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Mock no diamond contract found
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                null as never
            );

            const interactions = [
                {
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x01",
                        interactionData: "0xabcd",
                    },
                },
            ];

            // Act: Make POST request
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions }),
                })
            );

            // Assert: Should return empty array (filtered out)
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual([]);
            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });

        it("should return 401 when x-wallet-sdk-auth header is missing", async () => {
            // Act: Make POST request without auth header
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ interactions: [] }),
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.walletSdk.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.walletSdk.verify.mockResolvedValue(false as never);

            // Act: Make POST request with invalid token
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": "invalid-token",
                    },
                    body: JSON.stringify({ interactions: [] }),
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.walletSdk.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });

        it("should handle interactions with optional signature", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            dbMock.__setInsertResponse(() =>
                Promise.resolve([{ insertedId: 1n }])
            );

            const interactions = [
                {
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x01",
                        interactionData: "0xabcd",
                    },
                    signature: null,
                },
            ];

            // Act: Make POST request
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(["1"]);
        });

        it("should return 422 when interactions body is missing", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Act: Make POST request without interactions field
            const response = await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({}),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should emit newInteractions event after successful insert", async () => {
            // Arrange: Mock authenticated wallet session
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondAddress as never
            );

            dbMock.__setInsertResponse(() =>
                Promise.resolve([{ insertedId: 1n }])
            );

            const interactions = [
                {
                    wallet: mockWalletAddress,
                    productId: mockProductId,
                    interaction: {
                        handlerTypeDenominator: "0x01",
                        interactionData: "0xabcd",
                    },
                },
            ];

            // Act: Make POST request
            await pushInteractionsRoutes.handle(
                new Request("http://localhost/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({ interactions }),
                })
            );

            // Assert: Event should be emitted
            expect(eventEmitter.emit).toHaveBeenCalledWith("newInteractions");
        });
    });

    describe("POST /listenForPurchase (purchase.ts)", () => {
        it("should track purchase with valid hex address (legacy mode)", async () => {
            // Arrange: Mock hex address as auth
            const hexAddress = mockWalletAddress;
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make POST request with hex address
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": hexAddress,
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(eventEmitter.emit).toHaveBeenCalledWith(
                "newTrackedPurchase"
            );
            expect(JwtContextMock.walletSdk.verify).not.toHaveBeenCalled();
        });

        it("should track purchase with valid JWT token", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make POST request with JWT
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(JwtContextMock.walletSdk.verify).toHaveBeenCalledWith(
                validAuthToken
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith(
                "newTrackedPurchase"
            );
        });

        it("should return 401 when x-wallet-sdk-auth header is missing", async () => {
            // Act: Make POST request without auth header
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Missing wallet SDK JWT");
        });

        it("should return 401 when JWT token is invalid", async () => {
            // Arrange: Mock failed JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue(false as never);

            // Act: Make POST request with invalid JWT
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": "invalid-jwt-token",
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid wallet SDK JWT");
        });

        it("should handle string customerId and orderId", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make POST request with string IDs
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: "customer-string-123",
                        orderId: "order-string-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
        });

        it("should handle number customerId and orderId", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make POST request with number IDs
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: 12345,
                        orderId: 67890,
                        token: "token-789",
                    }),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
        });

        it("should emit newTrackedPurchase event after successful insert", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make POST request
            await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Event should be emitted
            expect(eventEmitter.emit).toHaveBeenCalledWith(
                "newTrackedPurchase"
            );
        });

        it("should return 422 when customerId is missing", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            // Act: Make POST request without customerId
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        orderId: "order-456",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when orderId is missing", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            // Act: Make POST request without orderId
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        token: "token-789",
                    }),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when token is missing", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            // Act: Make POST request without token
            const response = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify({
                        customerId: "customer-123",
                        orderId: "order-456",
                    }),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should handle onConflictDoNothing for duplicate purchases", async () => {
            // Arrange: Mock JWT verification
            JwtContextMock.walletSdk.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const purchaseData = {
                customerId: "customer-123",
                orderId: "order-456",
                token: "token-789",
            };

            // Act: Make POST request twice with same data
            const response1 = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify(purchaseData),
                })
            );

            const response2 = await purchaseInteractionsRoutes.handle(
                new Request("http://localhost/listenForPurchase", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": validAuthToken,
                    },
                    body: JSON.stringify(purchaseData),
                })
            );

            // Assert: Both should succeed (onConflictDoNothing)
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });
    });
});
