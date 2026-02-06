import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getBackendUrl } from "./backendUrl";

describe("getBackendUrl", () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        vi.stubGlobal("window", { ...originalWindow });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("with explicit walletUrl", () => {
        test("should return localhost backend for localhost:3000", () => {
            expect(getBackendUrl("https://localhost:3000")).toBe(
                "http://localhost:3030"
            );
        });

        test("should return localhost backend for localhost:3010", () => {
            expect(getBackendUrl("https://localhost:3010")).toBe(
                "http://localhost:3030"
            );
        });

        test("should return dev backend for wallet-dev.frak.id", () => {
            expect(getBackendUrl("https://wallet-dev.frak.id")).toBe(
                "https://backend.gcp-dev.frak.id"
            );
        });

        test("should return dev backend for wallet.gcp-dev.frak.id", () => {
            expect(getBackendUrl("https://wallet.gcp-dev.frak.id")).toBe(
                "https://backend.gcp-dev.frak.id"
            );
        });

        test("should return production backend for wallet.frak.id", () => {
            expect(getBackendUrl("https://wallet.frak.id")).toBe(
                "https://backend.frak.id"
            );
        });

        test("should return production backend for unknown URLs", () => {
            expect(getBackendUrl("https://some-other-url.com")).toBe(
                "https://backend.frak.id"
            );
        });
    });

    describe("with FrakSetup global config", () => {
        test("should derive from window.FrakSetup.client.config.walletUrl", () => {
            vi.stubGlobal("window", {
                FrakSetup: {
                    client: {
                        config: {
                            walletUrl: "https://wallet-dev.frak.id",
                        },
                    },
                },
            });

            expect(getBackendUrl()).toBe("https://backend.gcp-dev.frak.id");
        });

        test("should fall back to production when FrakSetup has no walletUrl", () => {
            vi.stubGlobal("window", {
                FrakSetup: { client: { config: {} } },
            });

            expect(getBackendUrl()).toBe("https://backend.frak.id");
        });
    });

    describe("fallback", () => {
        test("should return production URL when no walletUrl and no FrakSetup", () => {
            vi.stubGlobal("window", {});
            expect(getBackendUrl()).toBe("https://backend.frak.id");
        });
    });
});
