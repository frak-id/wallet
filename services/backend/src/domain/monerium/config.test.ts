import { describe, expect, it } from "vitest";
import { readMoneriumConfig } from "./config";

const env = {
    MONERIUM_CLIENT_ID: "client-1",
    FRAK_WALLET_URL: "https://wallet.frak.id/",
    MONERIUM_APP_NAME: " Frak Sandbox ",
};

describe("readMoneriumConfig", () => {
    it("targets production on Arbitrum", () => {
        expect(readMoneriumConfig(env, true)).toEqual({
            clientId: "client-1",
            environment: "production",
            apiBaseUrl: "https://api.monerium.app",
            chain: "arbitrum",
            chainId: 42161,
            walletUrl: "https://wallet.frak.id",
            redirectUri: "https://wallet.frak.id/monerium/callback",
            siweDomain: "wallet.frak.id",
            siweAppName: "Frak Sandbox",
        });
    });

    it("targets the sandbox on Arbitrum Sepolia", () => {
        expect(readMoneriumConfig(env, false)).toMatchObject({
            environment: "sandbox",
            apiBaseUrl: "https://api.monerium.dev",
            chain: "arbitrumsepolia",
            chainId: 421614,
        });
    });

    it("keeps the port in the SIWE domain", () => {
        expect(
            readMoneriumConfig(
                { ...env, FRAK_WALLET_URL: "https://localhost:3000" },
                false
            )?.siweDomain
        ).toBe("localhost:3000");
    });

    it("returns null when the client id, app name or wallet URL is missing or invalid", () => {
        expect(
            readMoneriumConfig({ FRAK_WALLET_URL: env.FRAK_WALLET_URL }, true)
        ).toBeNull();
        expect(
            readMoneriumConfig({ MONERIUM_CLIENT_ID: "c" }, true)
        ).toBeNull();
        expect(
            readMoneriumConfig({ ...env, MONERIUM_APP_NAME: " " }, true)
        ).toBeNull();
        expect(
            readMoneriumConfig({ ...env, FRAK_WALLET_URL: "not a url" }, true)
        ).toBeNull();
    });
});
