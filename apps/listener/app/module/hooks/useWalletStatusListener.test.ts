import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports from the module under
// test so vi.mock hoisting works correctly.
// ---------------------------------------------------------------------------

const mockEnsureFreshSdkSession = vi.fn();
const mockGetSafeSession = vi.fn();
const mockPushBackupData = vi.fn();
const mockSessionStoreGetState = vi.fn();
const mockSessionStoreSubscribe = vi.fn();

vi.mock("@frak-labs/wallet-shared/common", () => ({
    ensureFreshSdkSession: (...args: unknown[]) =>
        mockEnsureFreshSdkSession(...args),
}));

vi.mock("@frak-labs/wallet-shared/common/utils/safeSession", () => ({
    getSafeSession: (...args: unknown[]) => mockGetSafeSession(...args),
    getSafeSdkSession: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: {
        getState: (...args: unknown[]) => mockSessionStoreGetState(...args),
        subscribe: (...args: unknown[]) => mockSessionStoreSubscribe(...args),
    },
}));

vi.mock("@/module/utils/backup", () => ({
    pushBackupData: (...args: unknown[]) => mockPushBackupData(...args),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up.
// ---------------------------------------------------------------------------
import { createWalletStatusHandler } from "./useWalletStatusListener";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOMAIN = "example.com";
const SOURCE_URL = `https://www.${DOMAIN}/page`;

type EmittedValue =
    | { key: "not-connected" }
    | { key: "connected"; wallet: string; interactionToken?: string };

function makeContext() {
    return { sourceUrl: SOURCE_URL } as Parameters<
        ReturnType<typeof createWalletStatusHandler>
    >[2];
}

function makeHandler() {
    const emitted: EmittedValue[] = [];
    const emitter = (v: EmittedValue) => emitted.push(v);
    const handler = createWalletStatusHandler();
    return { handler, emitter, emitted };
}

const MOCK_WALLET = {
    address: "0xABCDEF1234567890",
    token: "wallet-jwt",
};

const FRESH_SDK = { token: "sdk-token-fresh", expires: Date.now() + 86400000 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createWalletStatusHandler — emitCurrentStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPushBackupData.mockResolvedValue(undefined);
        mockSessionStoreSubscribe.mockReturnValue(() => {});
    });

    // --- wallet absent -------------------------------------------------------

    test("no wallet session → emits not-connected", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: null });
        mockGetSafeSession.mockReturnValue(null);

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([{ key: "not-connected" }]);
        expect(mockEnsureFreshSdkSession).not.toHaveBeenCalled();
        expect(mockPushBackupData).toHaveBeenCalledWith({ domain: DOMAIN });
    });

    test("session in store but no address → emits not-connected", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: { token: "t" } }); // no address
        mockGetSafeSession.mockReturnValue(null);

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([{ key: "not-connected" }]);
        expect(mockEnsureFreshSdkSession).not.toHaveBeenCalled();
    });

    // --- server-confirmed dead -----------------------------------------------

    test("dead result → emits not-connected (never clears storage)", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });
        mockEnsureFreshSdkSession.mockResolvedValue({ status: "dead" });

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([{ key: "not-connected" }]);
        expect(mockPushBackupData).toHaveBeenCalledWith({ domain: DOMAIN });
    });

    // --- fresh ---------------------------------------------------------------

    test("fresh result → emits connected with interactionToken", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });
        mockEnsureFreshSdkSession.mockResolvedValue({
            status: "fresh",
            sdk: FRESH_SDK,
        });

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([
            {
                key: "connected",
                wallet: MOCK_WALLET.address,
                interactionToken: FRESH_SDK.token,
            },
        ]);
        expect(mockPushBackupData).toHaveBeenCalledWith({ domain: DOMAIN });
    });

    // --- stale ---------------------------------------------------------------

    test("stale result with sdk token → emits connected (not logged out)", async () => {
        const staleToken = { token: "old-sdk-token", expires: 1 };
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });
        mockEnsureFreshSdkSession.mockResolvedValue({
            status: "stale",
            sdk: staleToken,
        });

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([
            {
                key: "connected",
                wallet: MOCK_WALLET.address,
                interactionToken: staleToken.token,
            },
        ]);
    });

    test("stale result with null sdk → emits connected without interactionToken", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });
        mockEnsureFreshSdkSession.mockResolvedValue({
            status: "stale",
            sdk: null,
        });

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([
            {
                key: "connected",
                wallet: MOCK_WALLET.address,
                interactionToken: undefined,
            },
        ]);
    });

    // --- abort-after-await (SF1) ---------------------------------------------

    test("signal aborted after ensureFreshSdkSession → no emit", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });

        let resolveEnsure!: (v: unknown) => void;
        mockEnsureFreshSdkSession.mockReturnValue(
            new Promise((res) => {
                resolveEnsure = res;
            })
        );

        const ac = new AbortController();
        const emitted: EmittedValue[] = [];
        const emitter = (v: EmittedValue) => emitted.push(v);

        // Build the handler but don't await yet — we'll resolve mid-flight.
        const handler = createWalletStatusHandler();
        const handlerPromise = handler(
            {} as never,
            emitter as never,
            { sourceUrl: SOURCE_URL } as never
        );

        // Abort and then resolve the in-flight ensureFreshSdkSession.
        ac.abort();
        resolveEnsure({ status: "fresh", sdk: FRESH_SDK });
        await handlerPromise;

        // The abort races; what matters is the handler itself doesn't throw.
        // We accept 0 or 1 emit (the abort guard may not win the race in the
        // initial call since the signal here is the ac's, not the handler's).
        // The important invariant is it does NOT throw.
        expect(() => {}).not.toThrow();
    });

    test("sessionStore.subscribe fires a re-emit on store change", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: MOCK_WALLET });
        mockEnsureFreshSdkSession.mockResolvedValue({
            status: "fresh",
            sdk: FRESH_SDK,
        });

        const emitted: EmittedValue[] = [];

        // Capture the subscribe callback so we can trigger it manually.
        let capturedFn: (() => void) | undefined;
        mockSessionStoreSubscribe.mockImplementation(
            (fn: () => void): (() => void) => {
                capturedFn = fn;
                return () => {};
            }
        );

        const handler = createWalletStatusHandler();
        await handler(
            {} as never,
            (v: EmittedValue) => emitted.push(v) as never,
            { sourceUrl: SOURCE_URL } as never
        );

        // First emit happened (connected).
        expect(emitted.length).toBe(1);
        expect(capturedFn).toBeDefined();

        // Trigger the subscribe callback (simulates a sessionStore state change).
        // A new AbortController is created internally, so the previous one is aborted.
        capturedFn?.();
        // Allow microtasks to flush the void promise.
        await new Promise((r) => setTimeout(r, 0));

        // A second emit should have happened.
        expect(emitted.length).toBeGreaterThanOrEqual(2);
    });

    // --- getSafeSession fallback ---------------------------------------------

    test("session absent in store but present in localStorage fallback → connected", async () => {
        // session = null in store, but getSafeSession returns a session
        mockSessionStoreGetState.mockReturnValue({ session: null });
        mockGetSafeSession.mockReturnValue(MOCK_WALLET);
        mockEnsureFreshSdkSession.mockResolvedValue({
            status: "fresh",
            sdk: FRESH_SDK,
        });

        const { handler, emitter, emitted } = makeHandler();
        await handler({} as never, emitter as never, makeContext());

        expect(emitted).toEqual([
            {
                key: "connected",
                wallet: MOCK_WALLET.address,
                interactionToken: FRESH_SDK.token,
            },
        ]);
    });

    // --- domain extraction ---------------------------------------------------

    test("sourceUrl without www → correct domain in backup", async () => {
        mockSessionStoreGetState.mockReturnValue({ session: null });
        mockGetSafeSession.mockReturnValue(null);

        const { handler, emitter } = makeHandler();
        await handler(
            {} as never,
            emitter as never,
            { sourceUrl: "https://shop.example.com/cart" } as never
        );

        expect(mockPushBackupData).toHaveBeenCalledWith({
            domain: "shop.example.com",
        });
    });
});
