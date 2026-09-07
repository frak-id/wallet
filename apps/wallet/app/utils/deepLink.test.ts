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

const platformMocks = vi.hoisted(() => ({
    isAndroid: vi.fn(() => false),
    isIOS: vi.fn(() => false),
    isTauri: vi.fn(() => true),
}));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_ANDROID() {
        return platformMocks.isAndroid();
    },
    get IS_IOS() {
        return platformMocks.isIOS();
    },
    get IS_TAURI() {
        return platformMocks.isTauri();
    },
    isStandalonePwa: () => false,
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

describe("initDeepLinks", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue({ token: "valid-token" });
        platformMocks.isTauri.mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should skip initialization when not running in Tauri", async () => {
        platformMocks.isTauri.mockReturnValue(false);

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
            replace: true,
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
            replace: true,
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

        expect(navigate).toHaveBeenCalledWith({ to: "/wallet", replace: true });
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
            replace: true,
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
            replace: true,
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
            replace: true,
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
            replace: true,
        });
    });

    test("should handle frakwallet-dev:// custom scheme (dev variant)", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet-dev://pair?id=pair-dev&mode=embedded"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "pair-dev", mode: "embedded" },
            replace: true,
        });
    });

    test("should handle compact /p/<id> HTTPS App Link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        // QR codes emit lowercase, but some scanners or shares may
        // uppercase the URL — the parser must lowercase the id so backend
        // lookups (byte-exact varchar) match the stored canonical form.
        openUrlHandler(["https://wallet.frak.id/P/ABC123DEF456"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "abc123def456", mode: "embedded" },
            replace: true,
        });
    });

    test("should handle compact frakwallet://p/<id> custom scheme", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://p/ABC123DEF456"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "abc123def456", mode: "embedded" },
            replace: true,
        });
    });

    test("should handle /explorer/<merchantId> HTTPS App Link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        // merchantId is folded from the path segment and lowercased so the
        // explorer lookup (byte-exact id match) sees the canonical form.
        openUrlHandler(["https://wallet.frak.id/explorer/Merchant-123"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/explorer/merchant-123",
            replace: true,
        });
    });

    test("should handle frakwallet://explorer/<merchantId> custom scheme", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://explorer/merchant-123"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/explorer/merchant-123",
            replace: true,
        });
    });

    test("should fall back to /explorer when no merchantId in path", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://explorer"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/explorer",
            replace: true,
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
            replace: true,
        });
    });

    test("should forward the install proof so a fragment is not needed", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "frakwallet://install?m=merchant-123&a=anonymous-456&p=proof-abc",
        ]);

        // `p` as a search param, not a fragment: this hop is an in-app `navigate`,
        // so a fragment would be gone by the time /install renders.
        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: {
                m: "merchant-123",
                a: "anonymous-456",
                p: "proof-abc",
            },
            replace: true,
        });
    });

    // The hosted install link — the one `buildInstallUrl` mints for the web
    // listener's sharing page — carries the proof in a fragment. On Android that
    // URL is a verified App Link, so tapping it with the app installed delivers it
    // here instead of to a browser. Reading search params alone drops the proof on
    // exactly the flow the sharing page exists to serve.
    test("should recover the proof from a #p= fragment on an https app link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "https://wallet.frak.id/install?m=merchant-123&a=anonymous-456#p=proof-abc",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: {
                m: "merchant-123",
                a: "anonymous-456",
                p: "proof-abc",
            },
            replace: true,
        });
    });

    test("should recover the proof from a #p= fragment on a custom scheme link", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "frakwallet://install?m=merchant-123&a=anonymous-456#p=proof-abc",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: {
                m: "merchant-123",
                a: "anonymous-456",
                p: "proof-abc",
            },
            replace: true,
        });
    });

    // Proofs are base64url and can carry `=` padding, so the fragment has to be
    // parsed as a query string rather than split on `=`.
    test("should round-trip a percent-encoded proof out of the fragment", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();
        const proof = "a+b/c=d";

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            `https://wallet.frak.id/install?m=merchant-123&a=anonymous-456#p=${encodeURIComponent(proof)}`,
        ]);

        const { search } = navigate.mock.calls[0][0] as {
            search: Record<string, string>;
        };
        expect(search.p).toBe(proof);
    });

    test("should prefer the search param when a link carries both carriers", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "frakwallet://install?m=merchant-123&a=anonymous-456&p=from-search#p=from-fragment",
        ]);

        const { search } = navigate.mock.calls[0][0] as {
            search: Record<string, string>;
        };
        expect(search.p).toBe("from-search");
    });

    test("omits the proof entirely when the link carries none", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://install?m=merchant-123"]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: { m: "merchant-123" },
            replace: true,
        });
        // Asserted on the keys, not via the object above: `toHaveBeenCalledWith` uses
        // `toEqual`, which treats an explicit `p: undefined` as absent. The search object
        // becomes the URL, so the difference is real.
        expect(
            Object.keys(
                (
                    navigate.mock.calls[0][0] as {
                        search: Record<string, string>;
                    }
                ).search
            )
        ).toEqual(["m"]);
    });

    test("carries the proof over an https app link too", async () => {
        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler([
            "https://wallet.frak.id/install?m=merchant-123&a=anonymous-456&p=proof-xyz",
        ]);

        expect(navigate).toHaveBeenCalledWith({
            to: "/install",
            search: {
                m: "merchant-123",
                a: "anonymous-456",
                p: "proof-xyz",
            },
            replace: true,
        });
    });
});

describe("deep link auth gate", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue(null);
        platformMocks.isTauri.mockReturnValue(true);
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

        expect(navigate).toHaveBeenCalledWith({
            to: "/register",
            replace: true,
        });
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
        expect(navigate).toHaveBeenCalledWith({
            to: "/register",
            replace: true,
        });
    });

    test("should store pending navigation action for explorer when unauthenticated", async () => {
        getSafeSessionMock.mockReturnValue(null);

        const { initDeepLinks } = await import("./deepLink");
        const navigate = vi.fn();

        await initDeepLinks(navigate);

        if (!openUrlHandler) {
            throw new Error("Expected openUrlHandler to be set");
        }

        openUrlHandler(["frakwallet://explorer/merchant-123"]);

        const actions = pendingActionsStore.getState().getValidActions();
        const navAction = actions.find(
            (a) => a.type === "navigation" && a.to === "/explorer/merchant-123"
        );
        expect(navAction).toBeDefined();
        expect(navigate).toHaveBeenCalledWith({
            to: "/register",
            replace: true,
        });
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
            replace: true,
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

        expect(navigate).toHaveBeenCalledWith({
            to: "/profile/recovery",
            replace: true,
        });
    });
});

describe("monerium OAuth callback", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        openUrlHandler = null;
        getSafeSessionMock.mockReturnValue({ token: "valid-token" });
        platformMocks.isTauri.mockReturnValue(true);
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
            replace: true,
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
            replace: true,
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
            replace: true,
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
            replace: true,
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
            replace: true,
            search: {},
        });
    });
});
