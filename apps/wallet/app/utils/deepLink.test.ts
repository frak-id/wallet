import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

type OpenUrlHandler = (urls: string[]) => void;

let openUrlHandler: OpenUrlHandler | null = null;

const onOpenUrlMock = vi.fn<(handler: OpenUrlHandler) => Promise<void>>(
    async (handler: OpenUrlHandler) => {
        openUrlHandler = handler;
    }
);

const getCurrentMock = vi.fn<() => Promise<string[]>>(() =>
    Promise.resolve([])
);

const getSafeSessionMock = vi.fn<() => { token: string } | null | undefined>(
    () => null
);

const mockEnsurePost = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isAndroid: vi.fn(() => false),
    isIOS: vi.fn(() => false),
    isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-deep-link", () => ({
    onOpenUrl: (handler: OpenUrlHandler) => onOpenUrlMock(handler),
    getCurrent: () => getCurrentMock(),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        getSafeSession: () => getSafeSessionMock(),
        authenticatedBackendApi: {
            user: {
                identity: {
                    ensure: {
                        post: mockEnsurePost,
                    },
                },
            },
        },
    };
});

vi.mock("@/module/common/utils/walletMode", () => ({
    isCryptoMode: true,
}));

describe("initDeepLinks", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue({ token: "valid-token" });
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should skip initialization when not running in Tauri", async () => {
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(false);

        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        expect(onOpenUrlMock).not.toHaveBeenCalled();
        expect(getCurrentMock).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    test("should handle cold-start pairing deep link", async () => {
        vi.useFakeTimers();
        getCurrentMock.mockResolvedValue(["frakwallet://pair?id=pair-123"]);

        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);
        vi.runAllTimers();

        const actions = pendingActionsStore.getState().getValidActions();
        const pairingAction = actions.find((a) => a.type === "pairing");
        expect(pairingAction).toBeDefined();
        expect(
            pairingAction?.type === "pairing" &&
                pairingAction.pairingId === "pair-123"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { mode: "embedded" },
        });
    });

    test("should handle warm-start send deep link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://send?to=0xabc"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/tokens/send",
            search: { to: "0xabc" },
        });
    });

    test("should route wallet deep link to /wallet", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://wallet"]);

        expect(navigate).toHaveBeenCalledWith({ to: "/wallet" });
    });

    test("should handle HTTPS App Link for pairing (Android)", async () => {
        vi.useFakeTimers();
        getCurrentMock.mockResolvedValue([
            "https://wallet-dev.frak.id/pair?id=pair-456",
        ]);

        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);
        vi.runAllTimers();

        const actions = pendingActionsStore.getState().getValidActions();
        const pairingAction = actions.find((a) => a.type === "pairing");
        expect(pairingAction).toBeDefined();
        expect(
            pairingAction?.type === "pairing" &&
                pairingAction.pairingId === "pair-456"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { mode: "embedded" },
        });
    });

    test("should handle warm-start HTTPS App Link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["https://wallet.frak.id/pair?id=pair-789"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const pairingAction = actions.find((a) => a.type === "pairing");
        expect(pairingAction).toBeDefined();
        expect(
            pairingAction?.type === "pairing" &&
                pairingAction.pairingId === "pair-789"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { mode: "embedded" },
        });
    });

    test("should ignore unknown HTTPS hosts", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["https://evil.example.com/pair?id=steal-me"]);

        expect(navigate).not.toHaveBeenCalled();
    });

    test("should handle install deep link when authenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://install?m=merchant-123&a=anonymous-456"]);

        // Should fire ensure call in background
        expect(mockEnsurePost).toHaveBeenCalledWith({
            merchantId: "merchant-123",
            anonymousId: "anonymous-456",
        });
        // Should navigate to /wallet
        expect(navigate).toHaveBeenCalledWith({ to: "/wallet" });
    });
});

describe("deep link auth gate", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue(null);
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should redirect to /register when unauthenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://send?to=0xabc"]);

        expect(navigate).toHaveBeenCalledWith({ to: "/register" });
        expect(navigate).not.toHaveBeenCalledWith(
            expect.objectContaining({ to: "/tokens/send" })
        );
    });

    test("should store pending navigation action when unauthenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://send?to=0xabc"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const navAction = actions.find((a) => a.type === "navigation");
        expect(navAction).toBeDefined();
        expect(
            navAction?.type === "navigation" && navAction.to === "/tokens/send"
        ).toBe(true);
    });

    test("should store pending pairing action when unauthenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://pair?id=pair-abc"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const pairingAction = actions.find((a) => a.type === "pairing");
        expect(pairingAction).toBeDefined();
        expect(
            pairingAction?.type === "pairing" &&
                pairingAction.pairingId === "pair-abc"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({ to: "/register" });
    });

    test("should store pending ensure action when unauthenticated install deep link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://install?m=merchant-123&a=anonymous-456"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const ensureAction = actions.find((a) => a.type === "ensure");
        expect(ensureAction).toBeDefined();
        expect(
            ensureAction?.type === "ensure" &&
                ensureAction.merchantId === "merchant-123" &&
                ensureAction.anonymousId === "anonymous-456"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({ to: "/register" });
    });

    test("should allow recovery deep link without auth", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://recovery"]);

        expect(navigate).toHaveBeenCalledWith({ to: "/profile/recovery" });
    });
});

describe("monerium OAuth callback", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue({ token: "valid-token" });
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should handle HTTPS App Link for monerium callback with code and state", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "https://wallet-dev.frak.id/monerium/callback?code=abc123&state=xyz",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/monerium/callback",
            search: { code: "abc123", state: "xyz" },
        });
    });

    test("should handle custom scheme monerium-callback with code and state", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "frakwallet://monerium-callback?code=abc123&state=xyz",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/monerium/callback",
            search: { code: "abc123", state: "xyz" },
        });
    });

    test("should handle monerium callback with only code parameter", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://monerium-callback?code=abc123"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/monerium/callback",
            search: { code: "abc123" },
        });
    });

    test("should handle monerium callback with only state parameter", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://monerium-callback?state=xyz"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/monerium/callback",
            search: { state: "xyz" },
        });
    });

    test("should handle monerium callback with no parameters", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://monerium-callback"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/monerium/callback",
            search: {},
        });
    });
});
