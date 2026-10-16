import { afterEach, beforeEach, vi } from "vitest";
import type { MoneriumConfig } from "../../src/domain/monerium/config";
import type { MoneriumConnectionRow } from "../../src/domain/monerium/db/schema";

export const WALLET = "0x00000000000000000000000000000000000000aa" as const;
export const OTHER_WALLET =
    "0x00000000000000000000000000000000000000bb" as const;

/** A connected row with no profile and no link; callers override what their case needs. */
export function connectionRow(
    overrides: Partial<MoneriumConnectionRow> = {}
): MoneriumConnectionRow {
    return {
        wallet: WALLET,
        moneriumUserId: "u",
        profileId: null,
        profileKind: null,
        profileState: null,
        profileReasonCode: null,
        walletLinkState: "none",
        status: "connected",
        accessTokenEncrypted: "x",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenEncrypted: "y",
        walletLinkPendingAt: null,
        profileStateChangedAt: null,
        siweFailedAt: null,
        stateCheckedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

export function fakeTokens() {
    return {
        withAccessToken: vi.fn(
            async (_wallet: string, call: (token: string) => unknown) =>
                call("token")
        ),
    };
}

export function testMoneriumConfig(
    overrides: Partial<MoneriumConfig> = {}
): MoneriumConfig {
    return {
        clientId: "client-1",
        environment: "sandbox",
        apiBaseUrl: "https://api.monerium.dev",
        chain: "arbitrumsepolia",
        chainId: 421614,
        walletUrl: "https://wallet.test",
        redirectUri: "https://wallet.test/monerium/callback",
        siweDomain: "wallet.test",
        siweAppName: "Frak Sandbox",
        ...overrides,
    };
}

export function asFake<T>(partial: object): T {
    return partial as unknown as T;
}

/** Stubs the env `requireMoneriumConfig` reads; call once at the top of a test file. */
export function stubMoneriumEnv() {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("MONERIUM_APP_NAME", "Frak Sandbox");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });
}
