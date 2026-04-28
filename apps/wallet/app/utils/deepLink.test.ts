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

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-123", mode: "embedded" },
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

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-456", mode: "embedded" },
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

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-789", mode: "embedded" },
        });
    });

    test("should handle HTTPS App Link with /pairing path (QR code format)", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        // QR codes generated by LaunchPairing/PairingView encode `/pairing`
        // (not `/pair`), so the deep link router must handle both.
        openUrlHandler([
            "https://wallet.frak.id/pairing?id=pair-qr&mode=embedded",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-qr", mode: "embedded" },
        });
    });

    test("should handle frakwallet://pairing custom scheme", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://pairing?id=pair-cs&mode=embedded"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-cs", mode: "embedded" },
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

    test("should navigate to /install for install deep link when authenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://install?m=merchant-123&a=anonymous-456"]);

        // Install is a public action — deep link handler just navigates to /install
        // (the /install page handles ensure logic)
        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: { m: "merchant-123", a: "anonymous-456" },
        });
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

    test("should store pending navigation action for pairing when unauthenticated", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://pair?id=pair-abc"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const navAction = actions.find(
            (a) => a.type === "navigation" && a.to === "/pairing"
        );
        expect(navAction).toBeDefined();
        expect(
            navAction?.type === "navigation" &&
                navAction.search?.id === "pair-abc"
        ).toBe(true);
        expect(navigate).toHaveBeenCalledWith({ to: "/register" });
    });

    test("should navigate to /install for install deep link when unauthenticated (public action)", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://install?m=merchant-123&a=anonymous-456"]);

        // Install is a public action — bypasses auth gate, navigates directly to /install
        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: { m: "merchant-123", a: "anonymous-456" },
        });
        // No pending actions stored by deep link handler (the /install page handles that)
        const actions = pendingActionsStore.getState().getValidActions();
        expect(actions).toHaveLength(0);
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
