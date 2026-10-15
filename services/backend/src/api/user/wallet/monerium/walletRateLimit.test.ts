import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials", () => ({ isRunningLocally: false }));
vi.mock("@backend-infrastructure", async () => {
    const { rateLimitMiddleware } = await import(
        "../../../../infrastructure/rateLimit/rateLimiter"
    );
    return {
        rateLimitMiddleware,
        JwtContext: {
            wallet: {
                verify: async (token: string) =>
                    token === "invalid" ? null : { address: token },
            },
        },
    };
});

import {
    moneriumWalletContext,
    walletRateLimit,
    walletRateLimitKey,
} from "./walletRateLimit";

const ALICE = "0x00000000000000000000000000000000000000aa";
const BOB = "0x00000000000000000000000000000000000000bb";

function app() {
    return new Elysia()
        .use(moneriumWalletContext)
        .use(walletRateLimit("monerium-wallet-test", 2))
        .get("/ping", () => "ok");
}

async function ping(server: ReturnType<typeof app>, wallet?: string) {
    const response = await server.handle(
        new Request("http://localhost/ping", {
            headers: wallet ? { "x-wallet-auth": wallet } : {},
        })
    );
    return response.status;
}

describe("walletRateLimit", () => {
    it("limits per wallet session address, whatever the caller's IP", async () => {
        const server = app();
        expect(await ping(server, ALICE)).toBe(200);
        expect(await ping(server, ALICE)).toBe(200);
        expect(await ping(server, ALICE)).toBe(429);
        expect(await ping(server, BOB)).toBe(200);
    });

    it("does not bucket a caller without a valid wallet session", async () => {
        const server = app();
        for (let call = 0; call < 5; call++) {
            expect(await ping(server)).toBe(200);
            expect(await ping(server, "invalid")).toBe(200);
        }
    });
});

describe("walletRateLimit on nested route groups", () => {
    it("covers routes registered through a child plugin after it", async () => {
        const child = new Elysia({ prefix: "/auth" }).get("/inner", () => "ok");
        const server = new Elysia()
            .use(moneriumWalletContext)
            .use(walletRateLimit("monerium-wallet-nested-test", 1))
            .use(child);
        const call = async () =>
            (
                await server.handle(
                    new Request("http://localhost/auth/inner", {
                        headers: { "x-wallet-auth": ALICE },
                    })
                )
            ).status;
        expect(await call()).toBe(200);
        expect(await call()).toBe(429);
    });
});

describe("walletRateLimitKey", () => {
    it("is case-insensitive on the address", () => {
        expect(walletRateLimitKey({ rateLimitWallet: "0xAbC" })).toBe(
            "wallet:0xabc"
        );
        expect(walletRateLimitKey({ rateLimitWallet: null })).toBeNull();
    });
});
