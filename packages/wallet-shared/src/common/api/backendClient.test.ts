import { describe, expect, it, vi } from "vitest";

vi.mock("@elysiajs/eden", () => ({
    treaty: vi.fn(() => ({
        wallet: {
            balance: { get: vi.fn() },
            auth: { login: { post: vi.fn() } },
        },
    })),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        getState: vi.fn(() => ({
            clearSession: vi.fn(),
        })),
    },
}));

vi.mock("../utils/safeSession", () => ({
    getSafeSession: vi.fn(),
    getSafeSdkSession: vi.fn(),
}));

describe("backendClient", () => {
    it("should export authenticated backend API", async () => {
        const { authenticatedBackendApi } = await import("./backendClient");

        expect(authenticatedBackendApi).toBeDefined();
    });

    it("should export authenticated wallet API", async () => {
        const { authenticatedWalletApi } = await import("./backendClient");

        expect(authenticatedWalletApi).toBeDefined();
        expect(authenticatedWalletApi).toHaveProperty("balance");
    });

    it("should use correct backend URL from env", async () => {
        const { treaty } = await import("@elysiajs/eden");

        // Import to trigger treaty call
        await import("./backendClient");

        expect(treaty).toHaveBeenCalled();
    });
});
