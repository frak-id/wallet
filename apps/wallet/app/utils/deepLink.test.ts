import { pairingStore } from "@frak-labs/wallet-shared";
import { vi } from "vitest";
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

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
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
    };
});

vi.mock("@/module/common/utils/walletMode", () => ({
    isCryptoMode: true,
}));

describe("initDeepLinks", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pairingStore.getState().clearPendingPairing();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue({ token: "valid-token" });
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);

        const { clearPendingDeepLink } = await import("./deepLink");
        clearPendingDeepLink();
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

        expect(pairingStore.getState().pendingPairingId).toBe("pair-123");
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

        expect(pairingStore.getState().pendingPairingId).toBe("pair-456");
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

        expect(pairingStore.getState().pendingPairingId).toBe("pair-789");
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
});

describe("deep link auth gate", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pairingStore.getState().clearPendingPairing();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue(null);
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);

        const { clearPendingDeepLink } = await import("./deepLink");
        clearPendingDeepLink();
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

    test("should store pending deep link when unauthenticated", async () => {
        const { initDeepLinks, getPendingDeepLink } = await import(
            "./deepLink"
        );
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://send?to=0xabc"]);

        const pending = getPendingDeepLink();
        expect(pending).toEqual({
            action: "send",
            to: "0xabc",
            amount: undefined,
            id: undefined,
            mode: undefined,
        });
    });

    test("should store pairing ID when unauthenticated pair deep link", async () => {
        const { initDeepLinks, getPendingDeepLink } = await import(
            "./deepLink"
        );
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://pair?id=pair-abc"]);

        expect(pairingStore.getState().pendingPairingId).toBe("pair-abc");
        expect(navigate).toHaveBeenCalledWith({ to: "/register" });

        const pending = getPendingDeepLink();
        expect(pending?.action).toBe("pair");
        expect(pending?.id).toBe("pair-abc");
    });

    test("should allow recovery deep link without auth", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://recovery"]);

        expect(navigate).toHaveBeenCalledWith({ to: "/settings/recovery" });
    });

    test("should consume pending deep link after auth", async () => {
        const { initDeepLinks, consumePendingDeepLink, getPendingDeepLink } =
            await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        // Trigger unauthenticated deep link
        openUrlHandler(["frakwallet://settings"]);
        expect(navigate).toHaveBeenCalledWith({ to: "/register" });
        expect(getPendingDeepLink()?.action).toBe("settings");

        // Simulate post-auth consumption
        navigate.mockClear();
        const consumed = consumePendingDeepLink(navigate);

        expect(consumed).toBe(true);
        expect(navigate).toHaveBeenCalledWith({ to: "/settings" });
        expect(getPendingDeepLink()).toBeNull();
    });

    test("should return false when no pending deep link to consume", async () => {
        const { consumePendingDeepLink } = await import("./deepLink");
        const navigate = vi.fn();

        const consumed = consumePendingDeepLink(navigate);

        expect(consumed).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
    });
});
