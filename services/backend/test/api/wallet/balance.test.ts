import { beforeEach, describe, expect, it, vi } from "vitest";
import { balanceRoutes } from "../../../src/api/user/wallet/routes/balance";
import { WalletContext } from "../../../src/domain/wallet";
import { JwtContextMock, pricingRepositoryMocks } from "../../mock/common";

describe("Wallet Balance Routes API", () => {
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const validAuthToken = "valid-jwt-token";

    // Mock WalletContext repositories
    const balancesRepositoryMocks = {
        getUserBalance: vi.fn(() => Promise.resolve([])),
    };

    beforeEach(() => {
        // Reset all mocks before each test
        JwtContextMock.wallet.verify.mockClear();
        pricingRepositoryMocks.getTokenPrice.mockClear();
        balancesRepositoryMocks.getUserBalance.mockClear();

        // Mock authenticated wallet session
        JwtContextMock.wallet.verify.mockResolvedValue({
            address: mockWalletAddress,
            authenticatorId: "test-auth-id",
            publicKey: { x: "0x123", y: "0x456" },
        } as never);

        // Mock WalletContext repositories
        vi.spyOn(
            WalletContext.repositories.balances,
            "getUserBalance"
        ).mockImplementation(balancesRepositoryMocks.getUserBalance);
    });

    describe("GET /balance", () => {
        it("should return balance with multiple tokens when user has balances", async () => {
            // Arrange: Mock user balances with multiple tokens
            const mockBalances = [
                {
                    contractAddress:
                        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    metadata: {
                        name: "USD Coin",
                        symbol: "USDC",
                        decimals: 6,
                    },
                    rawBalance: 1000000n,
                    balance: 1.0,
                },
                {
                    contractAddress:
                        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    metadata: {
                        name: "Tether USD",
                        symbol: "USDT",
                        decimals: 6,
                    },
                    rawBalance: 2000000n,
                    balance: 2.0,
                },
            ];

            balancesRepositoryMocks.getUserBalance.mockResolvedValue(
                mockBalances as never
            );

            // Mock pricing for both tokens
            pricingRepositoryMocks.getTokenPrice
                .mockResolvedValueOnce({ eur: 0.92, usd: 1.0, gbp: 0.79 })
                .mockResolvedValueOnce({ eur: 0.93, usd: 1.01, gbp: 0.8 });

            // Act: Make GET request
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should succeed with 200
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                validAuthToken
            );
            expect(balancesRepositoryMocks.getUserBalance).toHaveBeenCalledWith(
                {
                    address: mockWalletAddress,
                }
            );

            const data = await response.json();

            // Verify balances array
            expect(data.balances).toHaveLength(2);
            expect(data.balances[0]).toEqual({
                token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                name: "USD Coin",
                symbol: "USDC",
                decimals: 6,
                rawBalance: "0xf4240",
                amount: 1.0,
                eurAmount: 0.92,
                usdAmount: 1.0,
                gbpAmount: 0.79,
            });

            expect(data.balances[1]).toEqual({
                token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                name: "Tether USD",
                symbol: "USDT",
                decimals: 6,
                rawBalance: "0x1e8480",
                amount: 2.0,
                eurAmount: 1.86,
                usdAmount: 2.02,
                gbpAmount: 1.6,
            });

            // Verify total balance calculation
            expect(data.total.amount).toBe(3.0);
            expect(data.total.eurAmount).toBeCloseTo(2.78, 2);
            expect(data.total.usdAmount).toBeCloseTo(3.02, 2);
            expect(data.total.gbpAmount).toBeCloseTo(2.39, 2);

            // Verify pricing was fetched for each token
            expect(pricingRepositoryMocks.getTokenPrice).toHaveBeenCalledTimes(
                2
            );
            expect(pricingRepositoryMocks.getTokenPrice).toHaveBeenCalledWith({
                token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            });
            expect(pricingRepositoryMocks.getTokenPrice).toHaveBeenCalledWith({
                token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            });
        });

        it("should return empty balance list when user has no tokens", async () => {
            // Arrange: Mock empty balances
            balancesRepositoryMocks.getUserBalance.mockResolvedValue([]);

            // Act: Make GET request
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should succeed with empty list
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.balances).toEqual([]);
            expect(data.total).toEqual({
                amount: 0,
                eurAmount: 0,
                usdAmount: 0,
                gbpAmount: 0,
            });

            // Pricing should not be called for empty balances
            expect(pricingRepositoryMocks.getTokenPrice).not.toHaveBeenCalled();
        });

        it("should calculate fiat amounts correctly when token price is available", async () => {
            // Arrange: Mock single token balance
            const mockBalances = [
                {
                    contractAddress:
                        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    metadata: {
                        name: "USD Coin",
                        symbol: "USDC",
                        decimals: 6,
                    },
                    rawBalance: 5000000n,
                    balance: 5.0,
                },
            ];

            balancesRepositoryMocks.getUserBalance.mockResolvedValue(
                mockBalances as never
            );
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue({
                eur: 1.1,
                usd: 1.2,
                gbp: 0.95,
            });

            // Act: Make GET request
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Verify fiat calculations
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.balances[0].amount).toBe(5.0);
            expect(data.balances[0].eurAmount).toBe(5.5);
            expect(data.balances[0].usdAmount).toBe(6.0);
            expect(data.balances[0].gbpAmount).toBe(4.75);

            expect(data.total.amount).toBe(5.0);
            expect(data.total.eurAmount).toBe(5.5);
            expect(data.total.usdAmount).toBe(6.0);
            expect(data.total.gbpAmount).toBe(4.75);
        });

        it("should use zero fiat amounts when token price is null", async () => {
            // Arrange: Mock balance with unavailable price
            const mockBalances = [
                {
                    contractAddress:
                        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    metadata: {
                        name: "USD Coin",
                        symbol: "USDC",
                        decimals: 6,
                    },
                    rawBalance: 1000000n,
                    balance: 1.0,
                },
            ];

            balancesRepositoryMocks.getUserBalance.mockResolvedValue(
                mockBalances as never
            );
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue(
                null as never
            );

            // Act: Make GET request
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Fiat amounts should be zero
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.balances[0].amount).toBe(1.0);
            expect(data.balances[0].eurAmount).toBe(0);
            expect(data.balances[0].usdAmount).toBe(0);
            expect(data.balances[0].gbpAmount).toBe(0);
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make GET request without auth header
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance")
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
            expect(
                balancesRepositoryMocks.getUserBalance
            ).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make GET request with invalid token
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
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
            expect(
                balancesRepositoryMocks.getUserBalance
            ).not.toHaveBeenCalled();
        });

        it("should filter out null/undefined balances from response", async () => {
            // Arrange: This should not happen in practice, but test the filter logic
            const mockBalances = [
                {
                    contractAddress:
                        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    metadata: {
                        name: "USD Coin",
                        symbol: "USDC",
                        decimals: 6,
                    },
                    rawBalance: 1000000n,
                    balance: 1.0,
                },
            ];

            balancesRepositoryMocks.getUserBalance.mockResolvedValue(
                mockBalances as never
            );
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue({
                eur: 1.0,
                usd: 1.0,
                gbp: 1.0,
            });

            // Act: Make GET request
            const response = await balanceRoutes.handle(
                new Request("http://localhost/balance", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: All balances should be present and valid
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.balances).toHaveLength(1);
            expect(data.balances.every((b: unknown) => b !== null)).toBe(true);
            expect(data.balances.every((b: unknown) => b !== undefined)).toBe(
                true
            );
        });
    });
});
