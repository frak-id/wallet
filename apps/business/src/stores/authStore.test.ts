import type { Address } from "viem";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

const WALLET = "0x0000000000000000000000000000000000000001" as Address;

describe("authStore", () => {
    describe("initial state", () => {
        test("should have no session by default", ({
            freshAuthStore,
        }: TestContext) => {
            const state = freshAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.wallet).toBeNull();
            expect(state.accountId).toBeNull();
            expect(state.authMethod).toBeNull();
            expect(state.pending2fa).toBe(false);
            expect(state.isAuthenticated()).toBe(false);
        });
    });

    describe("setAuth", () => {
        test("stores a full SIWE session as authenticated", ({
            freshAuthStore,
        }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                wallet: WALLET,
                authMethod: "siwe",
                expiresAt: Date.now() + 10_000,
            });

            const state = freshAuthStore.getState();
            expect(state.wallet).toBe(WALLET);
            expect(state.authMethod).toBe("siwe");
            expect(state.pending2fa).toBe(false);
            expect(state.isAuthenticated()).toBe(true);
        });

        test("a pending2fa session is not authenticated (§4.8)", ({
            freshAuthStore,
        }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                authMethod: "password",
                expiresAt: Date.now() + 10_000,
                pending2fa: true,
            });

            expect(freshAuthStore.getState().isAuthenticated()).toBe(false);
        });

        test("defaults wallet/accountId to null (walletless account)", ({
            freshAuthStore,
        }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                authMethod: "password",
                expiresAt: Date.now() + 10_000,
            });

            const state = freshAuthStore.getState();
            expect(state.wallet).toBeNull();
            expect(state.accountId).toBeNull();
        });
    });

    describe("setWallet", () => {
        test("attaches a wallet to an existing walletless session", ({
            freshAuthStore,
        }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                authMethod: "password",
                expiresAt: Date.now() + 10_000,
            });

            freshAuthStore.getState().setWallet(WALLET);

            expect(freshAuthStore.getState().wallet).toBe(WALLET);
        });
    });

    describe("clearAuth", () => {
        test("resets every field", ({ freshAuthStore }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                wallet: WALLET,
                accountId: "acc-1",
                authMethod: "siwe",
                expiresAt: Date.now() + 10_000,
            });

            freshAuthStore.getState().clearAuth();

            const state = freshAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.wallet).toBeNull();
            expect(state.accountId).toBeNull();
            expect(state.authMethod).toBeNull();
            expect(state.pending2fa).toBe(false);
        });
    });

    describe("isAuthenticated", () => {
        test("is false once expiresAt is in the past", ({
            freshAuthStore,
        }: TestContext) => {
            freshAuthStore.getState().setAuth({
                token: "tok",
                wallet: WALLET,
                authMethod: "siwe",
                expiresAt: Date.now() - 1,
            });

            expect(freshAuthStore.getState().isAuthenticated()).toBe(false);
        });
    });

    describe("persisted-shape migration (pre-account-model sessions)", () => {
        test("migrate() backfills accountId/authMethod/pending2fa from a wallet-only legacy shape", async () => {
            const { useAuthStore } = await import("./authStore");
            const migrate = useAuthStore.persist.getOptions().migrate;
            expect(migrate).toBeDefined();

            const legacyPersistedState = {
                token: "legacy-token",
                wallet: WALLET,
                expiresAt: Date.now() + 10_000,
            };

            const migrated = (await migrate?.(legacyPersistedState, 0)) as {
                token: string;
                wallet: Address;
                accountId: string | null;
                authMethod: string | null;
                pending2fa: boolean;
            };

            expect(migrated.token).toBe("legacy-token");
            expect(migrated.wallet).toBe(WALLET);
            expect(migrated.accountId).toBeNull();
            expect(migrated.authMethod).toBe("siwe");
            expect(migrated.pending2fa).toBe(false);
        });

        test("migrate() tolerates a fully empty persisted state", async () => {
            const { useAuthStore } = await import("./authStore");
            const migrate = useAuthStore.persist.getOptions().migrate;

            const migrated = (await migrate?.(undefined, 0)) as {
                accountId: string | null;
                authMethod: string | null;
                pending2fa: boolean;
            };

            expect(migrated.accountId).toBeNull();
            expect(migrated.authMethod).toBeNull();
            expect(migrated.pending2fa).toBe(false);
        });
    });
});
