import { parseSiweMessage } from "viem/siwe";
import { describe, expect, it } from "vitest";
import type { MoneriumConfig } from "../config";
import { buildMoneriumSiweMessage } from "./siweMessage";

const config: MoneriumConfig = {
    clientId: "client-1",
    environment: "production",
    apiBaseUrl: "https://api.monerium.app",
    chain: "arbitrum",
    chainId: 42161,
    walletUrl: "https://wallet.frak.id",
    redirectUri: "https://wallet.frak.id/monerium/callback",
    siweDomain: "wallet.frak.id",
    siweEnabled: true,
};

const ADDRESS = "0xf9ca5763A2d7a908d9a565567C80C069eCDd1B52" as const;
const NOW = new Date("2026-10-15T12:00:00Z");

describe("buildMoneriumSiweMessage", () => {
    const message = buildMoneriumSiweMessage({
        address: ADDRESS,
        config,
        now: NOW,
        nonce: "8YOaY6qkvyf7F5lx",
    });
    const parsed = parseSiweMessage(message);

    it("binds the wallet host, the wallet address and the callback URI", () => {
        expect(message.startsWith("wallet.frak.id wants you to sign in")).toBe(
            true
        );
        expect(parsed).toMatchObject({
            domain: "wallet.frak.id",
            address: ADDRESS,
            uri: "https://wallet.frak.id/monerium/callback",
            version: "1",
            chainId: 42161,
            nonce: "8YOaY6qkvyf7F5lx",
            statement: "Allow Frak Wallet to access my data on Monerium",
        });
    });

    it("expires 10 minutes after it was issued", () => {
        expect(parsed?.issuedAt?.toISOString()).toBe(
            "2026-10-15T12:00:00.000Z"
        );
        expect(parsed?.expirationTime?.toISOString()).toBe(
            "2026-10-15T12:10:00.000Z"
        );
    });

    it("lists the Monerium SIWE URL first, then privacy and terms", () => {
        expect(parsed?.resources).toEqual([
            "https://monerium.com/siwe",
            "https://frak.id/privacy",
            "https://frak.id/terms",
        ]);
    });

    it("uses the sandbox chain id outside production", () => {
        const sandbox = buildMoneriumSiweMessage({
            address: ADDRESS,
            config: { ...config, chainId: 421614 },
            now: NOW,
        });
        expect(parseSiweMessage(sandbox)?.chainId).toBe(421614);
    });
});
