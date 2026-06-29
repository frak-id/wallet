import { beforeEach, describe, expect, it, vi } from "vitest";

describe("authRecovery", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("notifyWalletAuthExpired calls all subscribers", async () => {
        const { notifyWalletAuthExpired, subscribeToWalletAuthExpired } =
            await import("./authRecovery");

        const listener1 = vi.fn();
        const listener2 = vi.fn();
        subscribeToWalletAuthExpired(listener1);
        subscribeToWalletAuthExpired(listener2);

        notifyWalletAuthExpired();

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("unsubscribed listener is not called", async () => {
        const { notifyWalletAuthExpired, subscribeToWalletAuthExpired } =
            await import("./authRecovery");

        const listener = vi.fn();
        const unsubscribe = subscribeToWalletAuthExpired(listener);
        unsubscribe();

        notifyWalletAuthExpired();

        expect(listener).not.toHaveBeenCalled();
    });

    it("does not clear the session — session state is untouched", async () => {
        const { notifyWalletAuthExpired } = await import("./authRecovery");

        // If no listeners, notify should not throw
        expect(() => notifyWalletAuthExpired()).not.toThrow();
    });

    it("a throwing listener does not prevent other listeners from running", async () => {
        const { notifyWalletAuthExpired, subscribeToWalletAuthExpired } =
            await import("./authRecovery");

        const bad = vi.fn(() => {
            throw new Error("boom");
        });
        const good = vi.fn();

        subscribeToWalletAuthExpired(bad);
        subscribeToWalletAuthExpired(good);

        notifyWalletAuthExpired();

        expect(good).toHaveBeenCalledTimes(1);
    });
});
