import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageNames = ["localStorage", "sessionStorage"] as const;

describe("bootstrap with third-party storage blocked", () => {
    const originalUrl = window.location.href;
    const descriptors = storageNames.map(
        (name) => [name, Object.getOwnPropertyDescriptor(window, name)] as const
    );

    beforeEach(() => {
        vi.resetModules();
        window.history.replaceState({}, "", "/listener?clientId=client-123");
        for (const name of storageNames) {
            Object.defineProperty(window, name, {
                configurable: true,
                get() {
                    throw new DOMException("Access is denied", "SecurityError");
                },
            });
        }
    });

    afterEach(() => {
        window.history.replaceState({}, "", originalUrl);
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(window, name, descriptor);
        }
    });

    it("still answers the SDK with connected", async () => {
        const controller = new AbortController();
        const connected = new Promise<void>((resolve) => {
            window.addEventListener(
                "message",
                (event) => {
                    if (event.data?.iframeLifecycle === "connected") resolve();
                },
                { signal: controller.signal }
            );
        });

        const { bootstrap } = await import("./bootstrap");
        const { cleanup } = bootstrap();

        await expect(connected).resolves.toBeUndefined();
        controller.abort();
        cleanup();
    });

    it("reports the wallet as not connected", async () => {
        const { createWalletStatusHandler } = await import(
            "./module/hooks/useWalletStatusListener"
        );
        const emitter = vi.fn();

        await createWalletStatusHandler()(undefined as never, emitter, {
            sourceUrl: "https://merchant.example/",
        } as never);

        expect(emitter).toHaveBeenCalledWith({ key: "not-connected" });
    });

    it("keeps the iframe clientId", async () => {
        const { iframeClientId } = await import(
            "./module/stores/resolvingContextStore"
        );
        const { clientIdStore } = await import(
            "@frak-labs/wallet-shared/stores/clientIdStore"
        );

        expect(iframeClientId).toBe("client-123");
        expect(clientIdStore.getState().clientId).toBe("client-123");
    });
});
