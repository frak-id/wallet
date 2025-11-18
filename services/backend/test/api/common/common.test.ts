import { beforeEach, describe, expect, it } from "vitest";
import { commonRoutes } from "../../../src/api/common/common";
import {
    adminWalletsRepositoryMocks,
    pricingRepositoryMocks,
} from "../../mock/common";

describe("Common Routes API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        adminWalletsRepositoryMocks.getProductSpecificAccount.mockClear();
        adminWalletsRepositoryMocks.getKeySpecificAccount.mockClear();
        pricingRepositoryMocks.getTokenPrice.mockClear();
    });

    describe("GET /adminWallet", () => {
        it("should return admin wallet for valid productId", async () => {
            const mockAccount = {
                address: "0x1234567890123456789012345678901234567890",
            };
            adminWalletsRepositoryMocks.getProductSpecificAccount.mockResolvedValue(
                mockAccount as never
            );

            const response = await commonRoutes.handle(
                new Request("http://localhost/adminWallet?productId=0x1")
            );

            expect(response.status).toBe(200);
            expect(
                adminWalletsRepositoryMocks.getProductSpecificAccount
            ).toHaveBeenCalledWith({
                productId: 1n,
            });

            const data = await response.json();
            expect(data).toEqual({
                pubKey: mockAccount.address,
            });
        });

        it("should return 422 for invalid productId (not hex)", async () => {
            const response = await commonRoutes.handle(
                new Request("http://localhost/adminWallet?productId=invalid")
            );

            // Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(
                adminWalletsRepositoryMocks.getProductSpecificAccount
            ).not.toHaveBeenCalled();
        });

        it("should return admin wallet for valid key", async () => {
            const mockAccount = {
                address: "0x1234567890123456789012345678901234567890",
            };
            adminWalletsRepositoryMocks.getKeySpecificAccount.mockResolvedValue(
                mockAccount as never
            );

            const response = await commonRoutes.handle(
                new Request("http://localhost/adminWallet?key=test-key")
            );

            expect(response.status).toBe(200);
            expect(
                adminWalletsRepositoryMocks.getKeySpecificAccount
            ).toHaveBeenCalledWith({
                key: "test-key",
            });

            const data = await response.json();
            expect(data).toEqual({
                pubKey: mockAccount.address,
            });
        });

        it("should return 400 when neither productId nor key is provided", async () => {
            const response = await commonRoutes.handle(
                new Request("http://localhost/adminWallet")
            );

            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid query");
        });

        it("should prioritize productId over key when both are provided", async () => {
            const mockAccount = {
                address: "0x1234567890123456789012345678901234567890",
            };
            adminWalletsRepositoryMocks.getProductSpecificAccount.mockResolvedValue(
                mockAccount as never
            );

            const response = await commonRoutes.handle(
                new Request(
                    "http://localhost/adminWallet?productId=0x1&key=test-key"
                )
            );

            expect(response.status).toBe(200);
            expect(
                adminWalletsRepositoryMocks.getProductSpecificAccount
            ).toHaveBeenCalled();
            expect(
                adminWalletsRepositoryMocks.getKeySpecificAccount
            ).not.toHaveBeenCalled();
        });
    });

    describe("GET /rate", () => {
        it("should return token price for valid address", async () => {
            const mockPrice = {
                usd: 1.5,
                eur: 1.3,
                gbp: 1.1,
            };
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue(mockPrice);

            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const response = await commonRoutes.handle(
                new Request(`http://localhost/rate?token=${tokenAddress}`)
            );

            expect(response.status).toBe(200);
            expect(pricingRepositoryMocks.getTokenPrice).toHaveBeenCalledWith({
                token: tokenAddress,
            });

            const data = await response.json();
            expect(data).toEqual(mockPrice);
        });

        it("should return 422 for invalid token address", async () => {
            const response = await commonRoutes.handle(
                new Request("http://localhost/rate?token=invalid-address")
            );

            // Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(pricingRepositoryMocks.getTokenPrice).not.toHaveBeenCalled();
        });

        it("should return 400 when token price is not found", async () => {
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue(
                null as never
            );

            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const response = await commonRoutes.handle(
                new Request(`http://localhost/rate?token=${tokenAddress}`)
            );

            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid token");
        });

        it("should return 422 when token parameter is missing", async () => {
            const response = await commonRoutes.handle(
                new Request("http://localhost/rate")
            );

            // Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(pricingRepositoryMocks.getTokenPrice).not.toHaveBeenCalled();
        });

        it("should handle token address with different casing", async () => {
            const mockPrice = {
                usd: 2.0,
                eur: 1.8,
                gbp: 1.6,
            };
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue(mockPrice);

            // Mixed case address (valid checksum)
            const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
            const response = await commonRoutes.handle(
                new Request(`http://localhost/rate?token=${tokenAddress}`)
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(mockPrice);
        });
    });
});
