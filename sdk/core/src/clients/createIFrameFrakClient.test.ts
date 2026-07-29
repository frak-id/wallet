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
