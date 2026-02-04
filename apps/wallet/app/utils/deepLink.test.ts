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

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-deep-link", () => ({
    onOpenUrl: (handler: OpenUrlHandler) => onOpenUrlMock(handler),
    getCurrent: () => getCurrentMock(),
}));

describe("initDeepLinks", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pairingStore.getState().clearPendingPairing();
        openUrlHandler = null;
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
});
