import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";

let mockIsRunningLocally = false;

vi.mock("@frak-labs/app-essentials", () => ({
    get isRunningLocally() {
        return mockIsRunningLocally;
    },
}));

vi.mock("@frak-labs/frame-connector", () => ({
    FrakRpcError: class FrakRpcError extends Error {
        code: number;
        constructor(code: number, message: string) {
            super(message);
            this.code = code;
        }
    },
    RpcErrorCodes: {
        configError: 4001,
    },
}));

vi.mock("@/module/stores/resolvingContextStore", () => ({
    resolvingContextStore: {
        getState: vi.fn(),
    },
}));

function makeMessage(topic: string) {
    return { topic, id: "test-id", data: [] } as any;
}

function makeContext(origin: string) {
    return { origin } as any;
}

describe("walletContextMiddleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsRunningLocally = false;
    });

    test("should throw when no resolving context available", async () => {
        const { resolvingContextStore } = await import(
            "@/module/stores/resolvingContextStore"
        );
        vi.mocked(resolvingContextStore.getState).mockReturnValue({
            context: null,
        } as any);

        const { walletContextMiddleware } = await import("./walletContext");
        const onRequest = walletContextMiddleware.onRequest!;

        expect(() =>
            onRequest(
                makeMessage("frak_sendInteraction"),
                makeContext("https://example.com")
            )
        ).toThrow("No resolving context available");
    });

    test("should return empty merchantId for same-origin messages", async () => {
        const { resolvingContextStore } = await import(
            "@/module/stores/resolvingContextStore"
        );
        vi.mocked(resolvingContextStore.getState).mockReturnValue({
            context: {
                merchantId: "merchant-123",
                sourceUrl: "https://example.com",
                clientId: "client-456",
            },
        } as any);

        const { walletContextMiddleware } = await import("./walletContext");
        const onRequest = walletContextMiddleware.onRequest!;

        const result = onRequest(
            makeMessage("frak_sendInteraction"),
            makeContext(window.origin)
        );

        expect(result).toEqual(
            expect.objectContaining({
                merchantId: "",
                sourceUrl: window.origin,
                clientId: "client-456",
            })
        );
    });

    test("should throw on origin mismatch in production", async () => {
        mockIsRunningLocally = false;

        const { resolvingContextStore } = await import(
            "@/module/stores/resolvingContextStore"
        );
        vi.mocked(resolvingContextStore.getState).mockReturnValue({
            context: {
                origin: "https://legit.com",
                merchantId: "m",
                sourceUrl: "https://legit.com",
                clientId: "c",
            },
        } as any);

        const { walletContextMiddleware } = await import("./walletContext");
        const onRequest = walletContextMiddleware.onRequest!;

        expect(() =>
            onRequest(
                makeMessage("frak_sendInteraction"),
                makeContext("https://attacker.com")
            )
        ).toThrow("Origin mismatch");
    });

    test("should allow origin mismatch in local development", async () => {
        mockIsRunningLocally = true;

        const { resolvingContextStore } = await import(
            "@/module/stores/resolvingContextStore"
        );
        vi.mocked(resolvingContextStore.getState).mockReturnValue({
            context: {
                origin: "https://legit.com",
                merchantId: "merchant-1",
                sourceUrl: "https://legit.com/page",
                clientId: "client-1",
            },
        } as any);

        const { walletContextMiddleware } = await import("./walletContext");
        const onRequest = walletContextMiddleware.onRequest!;

        // Use a non-localhost origin that differs from stored context
        // to test that local dev mode allows mismatches
        const result = onRequest(
            makeMessage("frak_sendInteraction"),
            makeContext("https://dev.example.com")
        );

        expect(result).toEqual(
            expect.objectContaining({
                merchantId: "merchant-1",
                sourceUrl: "https://legit.com/page",
                clientId: "client-1",
            })
        );
    });

    test("should augment context with wallet-specific fields on valid request", async () => {
        const { resolvingContextStore } = await import(
            "@/module/stores/resolvingContextStore"
        );
        vi.mocked(resolvingContextStore.getState).mockReturnValue({
            context: {
                origin: "https://example.com",
                merchantId: "merchant-abc",
                sourceUrl: "https://example.com/shop",
                clientId: "client-xyz",
            },
        } as any);

        const { walletContextMiddleware } = await import("./walletContext");
        const onRequest = walletContextMiddleware.onRequest!;

        const result = onRequest(
            makeMessage("frak_listenToWalletStatus"),
            makeContext("https://example.com")
        );

        expect(result).toEqual(
            expect.objectContaining({
                origin: "https://example.com",
                merchantId: "merchant-abc",
                sourceUrl: "https://example.com/shop",
                clientId: "client-xyz",
            })
        );
    });
});
