import { describe, expect, it, mock, afterAll } from "bun:test";
import type { Address } from "viem";
import { WalletSdkSessionService } from "./WalletSdkSessionService";

describe("WalletSdkSessionService", () => {
    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockJwtToken = "mock-jwt-token";
    const mockCurrentTime = 1640995200000; // 2022-01-01T00:00:00.000Z

    const mockWalletSdkJwt = {
        sign: mock(() => Promise.resolve(mockJwtToken)),
    };

    const service = new WalletSdkSessionService(mockWalletSdkJwt);

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    // Mock Date.now to return a consistent timestamp
    const originalDateNow = Date.now;
    Date.now = mock(() => mockCurrentTime);

    // Cleanup after tests
    afterAll(() => {
        Date.now = originalDateNow;
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("generateSdkJwt", () => {
        it("should generate JWT token with basic payload", async () => {
            const result = await service.generateSdkJwt({
                wallet: mockWallet,
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData: undefined,
            });

            expect(result).toEqual({
                token: mockJwtToken,
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7, // 7 days from now
            });
        });

        it("should include additional data when provided", async () => {
            const additionalData = {
                customField: "customValue",
                userId: "user123",
            };

            const result = await service.generateSdkJwt({
                wallet: mockWallet,
                additionalData,
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData,
            });

            expect(result).toEqual({
                token: mockJwtToken,
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7,
            });
        });

        it("should exclude additional data when empty object is provided", async () => {
            const result = await service.generateSdkJwt({
                wallet: mockWallet,
                additionalData: {},
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData: undefined,
            });

            expect(result).toEqual({
                token: mockJwtToken,
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7,
            });
        });

        it("should calculate correct expiration time (7 days)", async () => {
            const result = await service.generateSdkJwt({
                wallet: mockWallet,
            });

            const expectedExpiration = mockCurrentTime + (7 * 24 * 60 * 60 * 1000);
            expect(result.expires).toBe(expectedExpiration);
        });

        it("should handle JWT signing errors", async () => {
            const errorMockJwt = {
                sign: mock(() => Promise.reject(new Error("JWT signing failed"))),
            };
            const errorService = new WalletSdkSessionService(errorMockJwt);

            expect(
                errorService.generateSdkJwt({ wallet: mockWallet })
            ).rejects.toThrow("JWT signing failed");
        });
    });
});