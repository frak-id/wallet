import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FrakWalletSdkConfig } from "../types/config";

// --- Mocks -------------------------------------------------------------

vi.mock("../config/clientId", () => ({
    getClientId: vi.fn(() => "anon-client-id"),
    getClientIdAsync: vi.fn(async () => "anon-client-id"),
}));

vi.mock("../identity/sign", () => ({
    signProof: vi.fn(),
}));

vi.mock("./ssoUrlListener", () => ({
    setupSsoUrlListener: vi.fn(),
}));

const mockSha256 = vi.fn();
vi.mock("@noble/hashes/sha2.js", () => ({
    sha256: (...args: unknown[]) => mockSha256(...args),
}));

vi.mock("./transports/iframeLifecycleManager", () => ({
    createIFrameLifecycleManager: vi.fn(() => ({
        isConnected: Promise.resolve(true),
        handleEvent: vi.fn(),
    })),
}));

// `createRpcClient` is the only piece we fake; `Deferred` (used for
// `contextSent`) stays real so the resolve-timing assertions are meaningful.
vi.mock("@frak-labs/frame-connector", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/frame-connector")>();
    return {
        ...actual,
        createRpcClient: vi.fn(),
    };
});

let currentConfig: {
    isResolved: boolean;
    merchantId: string;
    domain: string;
    allowedDomains: string[];
};
let resolveFreshConfig: (value: unknown) => void;

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        setCacheScope: vi.fn(),
        reset: vi.fn(),
        clearCache: vi.fn(),
        // Stale-but-present cache: both SWR branches in
        // `postConnectionSetup` fire (cached send + fresh send).
        get isResolved() {
            return true;
        },
        get isCacheFresh() {
            return false;
        },
        getConfig: vi.fn(() => currentConfig),
        setConfig: vi.fn((config: typeof currentConfig) => {
            currentConfig = config;
        }),
        resolve: vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFreshConfig = resolve;
                })
        ),
    },
}));

describe("createIFrameFrakClient - sendLifecycleConfig ordering", () => {
    let sendLifecycle: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();

        // Real hashing by default; only the unhashable-binding case overrides it.
        const { sha256: realSha256 } = await vi.importActual<
            typeof import("@noble/hashes/sha2.js")
        >("@noble/hashes/sha2.js");
        mockSha256.mockImplementation(realSha256);

        currentConfig = {
            isResolved: true,
            merchantId: "cached-merchant",
            domain: "cached.example.com",
            allowedDomains: [],
        };

        Object.defineProperty(window, "location", {
            value: new URL("https://merchant.example.com/"),
            writable: true,
        });
        window.history.replaceState = vi.fn();

        sendLifecycle = vi.fn();
        const { createRpcClient } = await import("@frak-labs/frame-connector");
        vi.mocked(createRpcClient).mockReturnValue({
            sendLifecycle,
            request: vi.fn(),
            listen: vi.fn(),
            cleanup: vi.fn(),
        } as any);

        // First `signProof` call (the cached-config send) is made slower
        // than the second (the fresh-config send) — this is the real
        // interleaving described in the bug report: signing duration
        // varies per call, and nothing used to serialise the two sends.
        const { signProof } = await import("../identity/sign");
        let callCount = 0;
        vi.mocked(signProof).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                await new Promise((resolve) => setTimeout(resolve, 30));
                return "sig-slow-cached";
            }
            return "sig-fast-fresh";
        });
    });

    // The heartbeat also calls `rpcClient.sendLifecycle`; isolate the
    // `resolved-config` sends we care about from that noise.
    function resolvedConfigCalls() {
        return sendLifecycle.mock.calls
            .map(([event]) => event)
            .filter((event) => event.clientLifecycle === "resolved-config");
    }

    function makeIframe(): HTMLIFrameElement {
        const iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        return iframe;
    }

    function baseConfig(): FrakWalletSdkConfig {
        return {
            metadata: { name: "Test Merchant" },
        };
    }

    test("delivers the fresh-config resolved-config send after the cached-config one, even though its signing resolves first", async () => {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        // Not awaited: the client is still being built while we drive the
        // config resolution below. `createIFrameFrakClient` is now async (it
        // resolves the anonymous id before wiring OpenPanel), so give it a
        // turn to reach `sdkConfigStore.resolve()` and populate
        // `resolveFreshConfig`.
        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());

        // Let the cached-config branch call `sendLifecycleConfig`, and the
        // fresh-config branch start waiting on `configPromise`.
        await Promise.resolve();
        await Promise.resolve();

        // Resolve the fresh merchant config quickly, well before the slow
        // (30ms) signing on the cached-config send completes.
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(
            () => {
                expect(resolvedConfigCalls()).toHaveLength(2);
            },
            { timeout: 1000 }
        );

        const [firstCall, secondCall] = resolvedConfigCalls();
        expect(firstCall.data.merchantId).toBe("cached-merchant");
        expect(secondCall.data.merchantId).toBe("fresh-merchant");
    });

    test("holds RPC requests until the first resolved-config is actually posted", async () => {
        const { createRpcClient } = await import("@frak-labs/frame-connector");

        // Records how many `resolved-config` events had been posted at the
        // moment the gate let a request through. Must never be 0 — that is
        // exactly the "No resolving context available" boot failure.
        let sendsWhenReleased: number | undefined;
        // The probe is attached from inside the `createRpcClient` mock, i.e.
        // synchronously before `postConnectionSetup` can run. Attaching it
        // afterwards (via `waitFor`) would let the first send land during the
        // polling delay and mask the bug.
        vi.mocked(createRpcClient).mockImplementation((config: any) => {
            const gate = config.middleware?.[0];
            void gate?.onRequest?.({}, {}).then(() => {
                sendsWhenReleased = resolvedConfigCalls().length;
            });
            return {
                sendLifecycle,
                request: vi.fn(),
                listen: vi.fn(),
                cleanup: vi.fn(),
            } as any;
        });

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());

        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => expect(sendsWhenReleased).toBeDefined(), {
            timeout: 1000,
        });
        expect(sendsWhenReleased).toBeGreaterThan(0);
    });

    test("emits the execute proof under merge, and a distinct mergeSource", async () => {
        const { signProof } = await import("../identity/sign");
        vi.mocked(signProof).mockImplementation(async (params) =>
            params.binding ? "execute-proof" : `${params.op}-empty-binding`
        );
        Object.defineProperty(window, "location", {
            value: new URL("https://merchant.example.com/?fmt=merge-token-123"),
            writable: true,
        });

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
        await Promise.resolve();
        await Promise.resolve();
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => {
            expect(resolvedConfigCalls()).toHaveLength(2);
        });

        const { proofs } = resolvedConfigCalls()[0].data.sdkIdentity;
        expect(proofs.merge).toBe("execute-proof");
        expect(proofs.mergeSource).toBe("frak-merge-v1-empty-binding");
    });

    test("omits the execute key when the binding cannot be hashed, keeping mergeSource", async () => {
        const { signProof } = await import("../identity/sign");
        vi.mocked(signProof).mockImplementation(async (params) =>
            params.binding ? "execute-proof" : `${params.op}-empty-binding`
        );
        // No binding is producible: WebCrypto rejects and the pure-JS
        // fallback throws, which is the "never sign over the wrong
        // binding" hazard.
        mockSha256.mockImplementation(() => {
            throw new Error("no hashing available");
        });
        const subtle = crypto.subtle;
        Object.defineProperty(crypto, "subtle", {
            value: {
                digest: () => Promise.reject(new Error("insecure context")),
            },
            configurable: true,
        });
        Object.defineProperty(window, "location", {
            value: new URL("https://merchant.example.com/?fmt=merge-token-123"),
            writable: true,
        });

        try {
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            void createIFrameFrakClient({
                config: baseConfig(),
                iframe: makeIframe(),
            });
            await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
            await Promise.resolve();
            await Promise.resolve();
            resolveFreshConfig({
                merchantId: "fresh-merchant",
                domain: "fresh.example.com",
                allowedDomains: [],
            });

            await vi.waitFor(() => {
                expect(resolvedConfigCalls()).toHaveLength(2);
            });

            const { proofs } = resolvedConfigCalls()[0].data.sdkIdentity;
            expect(proofs.merge).toBeUndefined();
            expect(proofs.mergeSource).toBe("frak-merge-v1-empty-binding");
        } finally {
            Object.defineProperty(crypto, "subtle", {
                value: subtle,
                configurable: true,
            });
        }
    });

    test("removes the freshness listener when destroy wins the race against setup", async () => {
        const addSpy = vi.spyOn(document, "addEventListener");
        const removeSpy = vi.spyOn(document, "removeEventListener");

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        const client = await createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());

        // Destroy while `postConnectionSetup` is still pending: the teardown
        // it returns does not exist yet at this point.
        await client.destroy();
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });
        await client.waitForSetup;

        const added = addSpy.mock.calls.filter(
            ([type]) => type === "visibilitychange"
        );
        const removed = removeSpy.mock.calls.filter(
            ([type]) => type === "visibilitychange"
        );
        expect(added).toHaveLength(1);
        expect(removed).toHaveLength(1);
        expect(removed[0][1]).toBe(added[0][1]);

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    test("signs mergeSource even with no pending merge token", async () => {
        const { signProof } = await import("../identity/sign");
        vi.mocked(signProof).mockImplementation(async (params) =>
            params.binding ? "execute-proof" : `${params.op}-empty-binding`
        );

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
        await Promise.resolve();
        await Promise.resolve();
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => {
            expect(resolvedConfigCalls()).toHaveLength(2);
        });

        const { proofs } = resolvedConfigCalls()[0].data.sdkIdentity;
        expect(proofs.mergeSource).toBe("frak-merge-v1-empty-binding");
        expect(proofs.merge).toBeUndefined();
    });

    test("re-pushes a fresh mergeSource on visibilitychange without resurrecting the merge token", async () => {
        const { signProof } = await import("../identity/sign");
        let signCount = 0;
        vi.mocked(signProof).mockImplementation(async (params) => {
            if (params.binding) return "execute-proof";
            signCount++;
            return `source-proof-${signCount}`;
        });
        Object.defineProperty(window, "location", {
            value: new URL("https://merchant.example.com/?fmt=merge-token-123"),
            writable: true,
        });

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
        await Promise.resolve();
        await Promise.resolve();
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => {
            expect(resolvedConfigCalls()).toHaveLength(2);
        });
        const beforeRepush = resolvedConfigCalls().length;

        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));

        await vi.waitFor(() => {
            expect(resolvedConfigCalls().length).toBeGreaterThan(beforeRepush);
        });

        const repush = resolvedConfigCalls().at(-1);
        expect(repush.data.pendingMergeToken).toBeUndefined();
        expect(repush.data.sdkIdentity.proofs.mergeSource).not.toBe(
            "source-proof-1"
        );
    });

    test("throttles focus churn, then re-pushes on the freshness timer", async () => {
        vi.useFakeTimers();
        try {
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            void createIFrameFrakClient({
                config: baseConfig(),
                iframe: makeIframe(),
            });
            await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
            resolveFreshConfig({
                merchantId: "fresh-merchant",
                domain: "fresh.example.com",
                allowedDomains: [],
            });
            await vi.waitFor(() => {
                expect(resolvedConfigCalls()).toHaveLength(2);
            });

            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                configurable: true,
            });

            document.dispatchEvent(new Event("visibilitychange"));
            await vi.waitFor(() => {
                expect(resolvedConfigCalls()).toHaveLength(3);
            });

            // Second transition inside the throttle window: no extra signature.
            // Drained the same way a real re-push settles, so an unthrottled
            // send would be observed here.
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(100);
            expect(resolvedConfigCalls()).toHaveLength(3);

            // The timer keeps the stored proof inside its 600 s window even
            // on a tab that never hides.
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
            expect(resolvedConfigCalls().length).toBeGreaterThan(3);
        } finally {
            vi.useRealTimers();
        }
    });

    test("ignores a visibilitychange that leaves the tab hidden", async () => {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());
        await Promise.resolve();
        await Promise.resolve();
        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => {
            expect(resolvedConfigCalls()).toHaveLength(2);
        });
        const beforeRepush = resolvedConfigCalls().length;

        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();

        expect(resolvedConfigCalls()).toHaveLength(beforeRepush);
    });

    test("only the first sendLifecycleConfig call carries the pending merge token", async () => {
        Object.defineProperty(window, "location", {
            value: new URL("https://merchant.example.com/?fmt=merge-token-123"),
            writable: true,
        });

        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );

        void createIFrameFrakClient({
            config: baseConfig(),
            iframe: makeIframe(),
        });
        await vi.waitFor(() => expect(resolveFreshConfig).toBeDefined());

        await Promise.resolve();
        await Promise.resolve();

        resolveFreshConfig({
            merchantId: "fresh-merchant",
            domain: "fresh.example.com",
            allowedDomains: [],
        });

        await vi.waitFor(() => {
            expect(resolvedConfigCalls()).toHaveLength(2);
        });

        const [firstCall, secondCall] = resolvedConfigCalls();
        expect(firstCall.data.pendingMergeToken).toBe("merge-token-123");
        expect(secondCall.data.pendingMergeToken).toBeUndefined();
    });
});
