import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    clearSession: vi.fn(),
    onResponseHolder: {
        current: undefined as ((response: Response) => void) | undefined,
    },
}));

vi.mock("@elysiajs/eden", () => ({
    treaty: vi.fn(
        (
            _url: string,
            config?: { onResponse?: (response: Response) => void }
        ) => {
            mocks.onResponseHolder.current = config?.onResponse;
            return {
                user: {
                    wallet: {
                        balance: { get: vi.fn() },
                        auth: { login: { post: vi.fn() } },
                    },
                },
            };
        }
    ),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        getState: vi.fn(() => ({
            clearSession: mocks.clearSession,
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

describe("backendClient onResponse 401 handling", () => {
    function fakeResponse(status: number, path: string): Response {
        return {
            status,
            url: `https://localhost:3030${path}`,
        } as unknown as Response;
    }

    async function getOnResponse() {
        await import("./backendClient");
        const onResponse = mocks.onResponseHolder.current;
        if (!onResponse) {
            throw new Error("onResponse handler was not registered on treaty");
        }
        return onResponse;
    }

    beforeEach(() => {
        mocks.clearSession.mockClear();
    });

    it("does NOT clear the session on a 401 from the isValid probe", async () => {
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/auth/sdk/isValid"));

        expect(mocks.clearSession).not.toHaveBeenCalled();
    });

    it("clears the session on a 401 from sdk generate (dead wallet token)", async () => {
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/auth/sdk/generate"));

        expect(mocks.clearSession).toHaveBeenCalledTimes(1);
    });

    it("clears the session on a 401 from a non-sdk endpoint", async () => {
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/balance"));

        expect(mocks.clearSession).toHaveBeenCalledTimes(1);
    });

    it("ignores non-401 responses", async () => {
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(200, "/user/wallet/balance"));

        expect(mocks.clearSession).not.toHaveBeenCalled();
    });
});
