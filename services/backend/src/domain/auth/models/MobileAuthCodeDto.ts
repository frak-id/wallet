import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Mobile auth code JWT payload
 * Used for mobile app authentication redirect flow
 */
export const MobileAuthCodeDto = t.Object({
    // Wallet address
    address: t.Address(),
    // Product ID this code is valid for
    productId: t.Hex(),
    // Origin allowed to exchange this code
    origin: t.String(),
    // Unique code ID for one-time use tracking
    jti: t.String(),
    // Standard JWT claims
    sub: t.Address(),
    iat: t.Number(),
});

export type StaticMobileAuthCodeDto = Static<typeof MobileAuthCodeDto>;

/**
 * Request to generate a mobile auth code
 */
export const GenerateMobileAuthCodeRequestDto = t.Object({
    productId: t.Hex(),
    returnOrigin: t.String(),
});

export type StaticGenerateMobileAuthCodeRequestDto = Static<
    typeof GenerateMobileAuthCodeRequestDto
>;

/**
 * Response from generating a mobile auth code
 */
export const GenerateMobileAuthCodeResponseDto = t.Object({
    authCode: t.String(),
    expiresAt: t.Number(),
});

export type StaticGenerateMobileAuthCodeResponseDto = Static<
    typeof GenerateMobileAuthCodeResponseDto
>;

/**
 * Request to exchange a mobile auth code
 */
export const ExchangeMobileAuthCodeRequestDto = t.Object({
    authCode: t.String(),
    productId: t.Hex(),
});

export type StaticExchangeMobileAuthCodeRequestDto = Static<
    typeof ExchangeMobileAuthCodeRequestDto
>;

/**
 * Response from exchanging a mobile auth code
 */
export const ExchangeMobileAuthCodeResponseDto = t.Object({
    wallet: t.Address(),
    sdkJwt: t.Object({
        token: t.String(),
        expires: t.Number(),
    }),
});

export type StaticExchangeMobileAuthCodeResponseDto = Static<
    typeof ExchangeMobileAuthCodeResponseDto
>;
