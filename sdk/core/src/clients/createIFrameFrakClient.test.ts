import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FrakWalletSdkConfig } from "../types/config";

const openPanelTrack = vi.hoisted(() => vi.fn());
vi.mock("@openpanel/web", () => ({
    OpenPanel: class {
        track = openPanelTrack;
        init = vi.fn();
        setGlobalProperties = vi.fn();
        global = {};
    },
}));

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

    test("destroy({ detachOnly }) stops the client but keeps the iframe and the cached config", async () => {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );
        const { createRpcClient } = await import("@frak-labs/frame-connector");
        const { sdkConfigStore } = await import("../config/sdkConfigStore");
        const iframe = makeIframe();

        const client = await createIFrameFrakClient({
            config: baseConfig(),
            iframe,
        });
        vi.mocked(sdkConfigStore.reset).mockClear();
        await client.destroy({ detachOnly: true });

        const rpcClient = vi.mocked(createRpcClient).mock.results[0].value;
        expect(rpcClient.cleanup).toHaveBeenCalledTimes(1);
        expect(iframe.isConnected).toBe(true);
        expect(sdkConfigStore.clearCache).not.toHaveBeenCalled();
        expect(sdkConfigStore.reset).not.toHaveBeenCalled();
    });

    test("a client whose iframe left the DOM detaches instead of handling lifecycle events", async () => {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );
        const { createRpcClient } = await import("@frak-labs/frame-connector");
        const { createIFrameLifecycleManager } = await import(
            "./transports/iframeLifecycleManager"
        );
        const iframe = makeIframe();
        await createIFrameFrakClient({ config: baseConfig(), iframe });
        const { lifecycleHandlers } =
            vi.mocked(createRpcClient).mock.calls[0][0];
        const rpcClient = vi.mocked(createRpcClient).mock.results[0].value;
        const { handleEvent } = vi.mocked(createIFrameLifecycleManager).mock
            .results[0].value;
        const event = { iframeLifecycle: "show" } as const;
        const context = { origin: "https://wallet.frak.id", source: null };

        lifecycleHandlers?.iframeLifecycle?.(event, context);
        expect(handleEvent).toHaveBeenCalledTimes(1);

        iframe.remove();
        lifecycleHandlers?.iframeLifecycle?.(event, context);
        expect(handleEvent).toHaveBeenCalledTimes(1);
        expect(rpcClient.cleanup).toHaveBeenCalledTimes(1);
    });

    test("destroy() still removes the iframe and clears the cached config", async () => {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );
        const { sdkConfigStore } = await import("../config/sdkConfigStore");
        const iframe = makeIframe();

        const client = await createIFrameFrakClient({
            config: baseConfig(),
            iframe,
        });
        vi.mocked(sdkConfigStore.reset).mockClear();
        await client.destroy();

        expect(iframe.isConnected).toBe(false);
        expect(sdkConfigStore.clearCache).toHaveBeenCalledTimes(1);
        expect(sdkConfigStore.reset).toHaveBeenCalledTimes(1);
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

describe("createIFrameFrakClient - asset push failures", () => {
    let sendLifecycle: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.stubEnv("OPEN_PANEL_API_URL", "https://op.example.com");
        vi.stubEnv("OPEN_PANEL_SDK_CLIENT_ID", "op-client-id");

        currentConfig = {
            isResolved: true,
            merchantId: "merchant",
            domain: "merchant.example.com",
            allowedDomains: [],
        };

        const { signProof } = await import("../identity/sign");
        vi.mocked(signProof).mockResolvedValue(null);

        sendLifecycle = vi.fn();
        const { createRpcClient } = await import("@frak-labs/frame-connector");
        vi.mocked(createRpcClient).mockReturnValue({
            sendLifecycle,
            request: vi.fn(),
            listen: vi.fn(),
            cleanup: vi.fn(),
        } as any);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    async function setup(config: FrakWalletSdkConfig) {
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );
        const iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        const client = await createIFrameFrakClient({ config, iframe });
        resolveFreshConfig({
            merchantId: "merchant",
            domain: "merchant.example.com",
            allowedDomains: [],
        });
        await client.waitForSetup;
    }

    function handshakeFailures() {
        return openPanelTrack.mock.calls
            .filter(([event]) => event === "sdk_iframe_handshake_failed")
            .map(([, properties]) => properties);
    }

    test("treats blocked storage as no backup, not a failed handshake", async () => {
        vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
            throw new DOMException(
                "The operation is insecure.",
                "SecurityError"
            );
        });

        await setup({ metadata: { name: "Test Merchant" } });

        expect(handshakeFailures()).toEqual([]);
        expect(
            sendLifecycle.mock.calls.filter(
                ([event]) => event.clientLifecycle === "restore-backup"
            )
        ).toEqual([]);
    });

    test("names the asset and the error when a push fails", async () => {
        sendLifecycle.mockImplementation((event) => {
            if (event.clientLifecycle === "modal-i18n") {
                throw new TypeError("i18n is not cloneable");
            }
        });

        await setup({
            metadata: { name: "Test Merchant" },
            customizations: { i18n: { title: "Bonjour" } },
        });

        expect(handshakeFailures()).toEqual([
            {
                reason: "asset_push",
                asset: "i18n",
                error_name: "TypeError",
                error_message: "i18n is not cloneable",
            },
        ]);
    });
});

describe("createIFrameFrakClient - handshake deadline", () => {
    type Gate = {
        onRequest: (message: unknown, ctx: unknown) => Promise<unknown>;
    };
    let gate: Gate;
    let sendLifecycle: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        currentConfig = {
            isResolved: true,
            merchantId: "merchant",
            domain: "merchant.example.com",
            allowedDomains: [],
        };
        const { createRpcClient } = await import("@frak-labs/frame-connector");
        vi.mocked(createRpcClient).mockImplementation((config: any) => {
            gate = config.middleware[0];
            sendLifecycle = vi.fn();
            return {
                sendLifecycle,
                request: vi.fn(),
                listen: vi.fn(),
                cleanup: vi.fn(),
            } as any;
        });
    });

    async function setup(isConnected: Promise<boolean>) {
        const { createIFrameLifecycleManager } = await import(
            "./transports/iframeLifecycleManager"
        );
        vi.mocked(createIFrameLifecycleManager).mockReturnValueOnce({
            isConnected,
            handleEvent: vi.fn(),
        } as any);
        const { createIFrameFrakClient } = await import(
            "./createIFrameFrakClient"
        );
        const iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        const client = await createIFrameFrakClient({
            config: { metadata: { name: "Test Merchant" } },
            iframe,
        });
        return { client, iframe };
    }

    test("rejects pending requests and resolves waitForConnection false at the deadline", async () => {
        vi.useFakeTimers();
        try {
            const { client } = await setup(new Promise(() => {}));
            const request = gate.onRequest({}, {});
            const outcome = request.then(
                () => "resolved",
                (error) => error.code
            );

            await vi.advanceTimersByTimeAsync(29_999);
            expect(await Promise.race([outcome, "pending"])).toBe("pending");

            await vi.advanceTimersByTimeAsync(1);
            expect(await outcome).toBe(-32001);
            expect(await client.waitForConnection).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    const heartbeats = () =>
        sendLifecycle.mock.calls.filter(
            ([event]) => event.clientLifecycle === "heartbeat"
        ).length;

    test("stops pinging the iframe once it connects", async () => {
        vi.useFakeTimers();
        try {
            await setup(Promise.resolve(true));
            await vi.advanceTimersByTimeAsync(5_000);

            expect(heartbeats()).toBe(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test("stops pinging the iframe at the deadline", async () => {
        vi.useFakeTimers();
        try {
            await setup(new Promise(() => {}));

            await vi.advanceTimersByTimeAsync(30_000);
            const sent = heartbeats();
            await vi.advanceTimersByTimeAsync(5_000);

            expect(sent).toBeGreaterThan(100);
            expect(heartbeats()).toBe(sent);
        } finally {
            vi.useRealTimers();
        }
    });

    test("serves requests made after a late connection", async () => {
        vi.useFakeTimers();
        try {
            let connect!: (value: boolean) => void;
            await setup(new Promise((resolve) => (connect = resolve)));

            await vi.advanceTimersByTimeAsync(30_000);
            connect(true);
            resolveFreshConfig({
                merchantId: "merchant",
                domain: "merchant.example.com",
                allowedDomains: [],
            });

            await expect(gate.onRequest({}, "ctx")).resolves.toBe("ctx");
        } finally {
            vi.useRealTimers();
        }
    });

    test("rejects requests once the iframe is removed from the page", async () => {
        const { iframe } = await setup(Promise.resolve(true));
        iframe.remove();

        await expect(gate.onRequest({}, {})).rejects.toMatchObject({
            code: -32001,
        });
    });

    describe("streams", () => {
        async function runRealRpcClient() {
            const actual = await vi.importActual<
                typeof import("@frak-labs/frame-connector")
            >("@frak-labs/frame-connector");
            const { createRpcClient } = await import(
                "@frak-labs/frame-connector"
            );
            vi.mocked(createRpcClient).mockImplementation(
                actual.createRpcClient
            );
        }

        const listenPosts = (post: { mock: { calls: unknown[][] } }) =>
            post.mock.calls.filter(
                ([message]) =>
                    (message as { topic?: string })?.topic ===
                    "frak_listenToWalletStatus"
            ).length;

        test("watchWalletStatus rejects at the deadline when the iframe never connects", async () => {
            vi.useFakeTimers();
            vi.spyOn(console, "error").mockImplementation(() => {});
            try {
                await runRealRpcClient();
                const { client } = await setup(new Promise(() => {}));
                const { watchWalletStatus } = await import(
                    "../actions/watchWalletStatus"
                );
                const outcome = watchWalletStatus(client, vi.fn()).then(
                    () => "resolved",
                    (error) => error.code
                );

                await vi.advanceTimersByTimeAsync(29_999);
                expect(await Promise.race([outcome, "pending"])).toBe(
                    "pending"
                );

                await vi.advanceTimersByTimeAsync(1);
                expect(await outcome).toBe(-32001);
            } finally {
                vi.useRealTimers();
            }
        });

        test("a listen failed at the deadline reports it, and a new listen after a late connection is posted", async () => {
            vi.useFakeTimers();
            vi.spyOn(console, "error").mockImplementation(() => {});
            try {
                await runRealRpcClient();
                let connect!: (value: boolean) => void;
                const { client, iframe } = await setup(
                    new Promise((resolve) => (connect = resolve))
                );
                const post = vi.spyOn(
                    iframe.contentWindow as Window,
                    "postMessage"
                );
                const onError = vi.fn();
                client.listenerRequest(
                    { method: "frak_listenToWalletStatus" },
                    vi.fn(),
                    onError
                );

                await vi.advanceTimersByTimeAsync(29_999);
                expect(onError).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                expect(onError).toHaveBeenCalledTimes(1);
                expect(onError.mock.calls[0][0]).toMatchObject({
                    code: -32001,
                });

                connect(true);
                resolveFreshConfig({
                    merchantId: "merchant",
                    domain: "merchant.example.com",
                    allowedDomains: [],
                });
                await vi.advanceTimersByTimeAsync(1_000);
                await client.waitForSetup;
                client.listenerRequest(
                    { method: "frak_listenToWalletStatus" },
                    vi.fn(),
                    vi.fn()
                );

                await vi.waitFor(() => expect(listenPosts(post)).toBe(1));
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
