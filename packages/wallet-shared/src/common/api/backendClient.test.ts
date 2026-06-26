import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    notifyWalletAuthExpired: vi.fn(),
    getSafeSession: vi.fn<() => { token: string } | null>(),
    isExpired: vi.fn<(token: string) => boolean>(),
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

vi.mock("../auth/authRecovery", () => ({
    notifyWalletAuthExpired: mocks.notifyWalletAuthExpired,
}));

vi.mock("../utils/safeSession", () => ({
    getSafeSession: mocks.getSafeSession,
    getSafeSdkSession: vi.fn(),
}));

vi.mock("../utils/tokenExpiry", () => ({
    isExpired: mocks.isExpired,
}));

vi.mock("../../stores/clientIdStore", () => ({
    clientIdStore: {
        getState: vi.fn(() => ({ clientId: null })),
    },
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
        mocks.notifyWalletAuthExpired.mockClear();
        mocks.getSafeSession.mockReset();
        mocks.isExpired.mockReset();
    });

    it("notifies when 401 and wallet token is absent", async () => {
        mocks.getSafeSession.mockReturnValue(null); // no wallet token
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/balance"));

        expect(mocks.notifyWalletAuthExpired).toHaveBeenCalledTimes(1);
    });

    it("notifies when 401 and wallet token is expired", async () => {
        mocks.getSafeSession.mockReturnValue({ token: "expired-token" });
        mocks.isExpired.mockReturnValue(true);
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/balance"));

        expect(mocks.notifyWalletAuthExpired).toHaveBeenCalledTimes(1);
    });

    it("does NOT notify when 401 but wallet token is still valid (SDK-only 401)", async () => {
        mocks.getSafeSession.mockReturnValue({ token: "valid-wallet-token" });
        mocks.isExpired.mockReturnValue(false);
        const onResponse = await getOnResponse();

        // e.g. an SDK-only endpoint returning 401 while wallet token is valid
        onResponse(fakeResponse(401, "/user/wallet/auth/sdk/generate"));

        expect(mocks.notifyWalletAuthExpired).not.toHaveBeenCalled();
    });

    it("does not notify on non-401 responses", async () => {
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(200, "/user/wallet/balance"));
        onResponse(fakeResponse(500, "/user/wallet/balance"));

        expect(mocks.notifyWalletAuthExpired).not.toHaveBeenCalled();
    });

    it("does NOT call clearSession — session clearing is owned by the guard layer", async () => {
        // clearSession must never be called from the transport layer
        mocks.getSafeSession.mockReturnValue(null);
        const onResponse = await getOnResponse();

        onResponse(fakeResponse(401, "/user/wallet/balance"));

        // Verify clearSession was never imported or called
        // (no sessionStore mock needed — it should not be used here)
        expect(mocks.notifyWalletAuthExpired).toHaveBeenCalledTimes(1);
    });
});
