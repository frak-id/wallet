import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JwtContextMock } from "../../../../test/mock/common";
import { MobileAuthCodeService } from "./MobileAuthCodeService";
import { WalletSdkSessionService } from "./WalletSdkSessionService";

describe("MobileAuthCodeService", () => {
    let service: MobileAuthCodeService;
    let walletSdkSessionService: WalletSdkSessionService;

    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockProductId = "0xabcdef" as Hex;
    const mockOrigin = "https://partner.com";

    beforeEach(() => {
        walletSdkSessionService = new WalletSdkSessionService();
        service = new MobileAuthCodeService(walletSdkSessionService);

        JwtContextMock.mobileAuthCode.sign.mockReset();
        JwtContextMock.mobileAuthCode.verify.mockReset();
        JwtContextMock.walletSdk.sign.mockReset();

        JwtContextMock.mobileAuthCode.sign.mockResolvedValue(
            "mock-mobile-auth-code"
        );
        JwtContextMock.walletSdk.sign.mockResolvedValue("mock-sdk-jwt-token");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("generateAuthCode", () => {
        it("should generate auth code with correct payload", async () => {
            const mockTime = 1609459200000;
            vi.spyOn(Date, "now").mockReturnValue(mockTime);
            vi.spyOn(crypto, "randomUUID").mockReturnValue(
                "test-uuid-1234" as `${string}-${string}-${string}-${string}-${string}`
            );

            const result = await service.generateAuthCode({
                walletAddress: mockWallet,
                productId: mockProductId,
                returnOrigin: mockOrigin,
            });

            expect(JwtContextMock.mobileAuthCode.sign).toHaveBeenCalledWith({
                address: mockWallet,
                productId: mockProductId,
                origin: mockOrigin,
                jti: "test-uuid-1234",
                sub: mockWallet,
                iat: mockTime,
            });

            expect(result).toEqual({
                authCode: "mock-mobile-auth-code",
                expiresAt: mockTime + 60_000,
            });
        });

        it("should generate unique jti for each call", async () => {
            vi.spyOn(crypto, "randomUUID")
                .mockReturnValueOnce(
                    "uuid-1" as `${string}-${string}-${string}-${string}-${string}`
                )
                .mockReturnValueOnce(
                    "uuid-2" as `${string}-${string}-${string}-${string}-${string}`
                );

            await service.generateAuthCode({
                walletAddress: mockWallet,
                productId: mockProductId,
                returnOrigin: mockOrigin,
            });

            await service.generateAuthCode({
                walletAddress: mockWallet,
                productId: mockProductId,
                returnOrigin: mockOrigin,
            });

            expect(JwtContextMock.mobileAuthCode.sign).toHaveBeenCalledTimes(2);
            expect(JwtContextMock.mobileAuthCode.sign).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ jti: "uuid-1" })
            );
            expect(JwtContextMock.mobileAuthCode.sign).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ jti: "uuid-2" })
            );
        });
    });

    describe("exchangeAuthCode", () => {
        const validPayload = {
            address: mockWallet,
            productId: mockProductId,
            origin: mockOrigin,
            jti: "unique-jti-123",
            sub: mockWallet,
            iat: Date.now(),
        };

        it("should return null for invalid auth code", async () => {
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                false as never
            );

            const result = await service.exchangeAuthCode({
                authCode: "invalid-code",
                productId: mockProductId,
            });

            expect(result).toBeNull();
        });

        it("should return null for mismatched productId", async () => {
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                validPayload as never
            );

            const result = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: "0xdifferent" as Hex,
            });

            expect(result).toBeNull();
        });

        it("should return null for mismatched origin", async () => {
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                validPayload as never
            );

            const result = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: mockProductId,
                requestOrigin: "https://attacker.com",
            });

            expect(result).toBeNull();
        });

        it("should exchange valid auth code successfully", async () => {
            const payloadWithUniqueJti = {
                ...validPayload,
                jti: "valid-exchange-jti",
            };
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                payloadWithUniqueJti as never
            );

            const result = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: mockProductId,
                requestOrigin: mockOrigin,
            });

            expect(result).toEqual({
                wallet: mockWallet,
                sdkJwt: {
                    token: "mock-sdk-jwt-token",
                    expires: expect.any(Number),
                },
            });
        });

        it("should allow exchange without origin check if not provided", async () => {
            const payloadWithUniqueJti = {
                ...validPayload,
                jti: "no-origin-check-jti",
            };
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                payloadWithUniqueJti as never
            );

            const result = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: mockProductId,
            });

            expect(result).not.toBeNull();
            expect(result?.wallet).toBe(mockWallet);
        });

        it("should reject replay attacks (one-time use)", async () => {
            const uniquePayload = {
                ...validPayload,
                jti: "replay-test-jti",
            };
            JwtContextMock.mobileAuthCode.verify.mockResolvedValue(
                uniquePayload as never
            );

            const firstResult = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: mockProductId,
            });
            expect(firstResult).not.toBeNull();

            const secondResult = await service.exchangeAuthCode({
                authCode: "valid-code",
                productId: mockProductId,
            });
            expect(secondResult).toBeNull();
        });
    });
});
