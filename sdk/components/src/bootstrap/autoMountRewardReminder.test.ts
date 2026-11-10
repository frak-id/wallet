import { sdkConfigStore } from "@frak-labs/core-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoMountRewardReminder } from "./autoMountRewardReminder";

const mountRewardReminder = vi.hoisted(() => vi.fn());

vi.mock("./mountRewardReminder", () => ({ mountRewardReminder }));

function resolveConfig(
    overrides: { hidden?: boolean; enabled?: boolean } = {}
) {
    sdkConfigStore.setConfig({
        isResolved: true,
        merchantId: "merchant-1",
        hidden: overrides.hidden,
        components: { rewardReminder: { enabled: overrides.enabled } },
    });
}

function readyClient() {
    window.FrakSetup.client = {};
    window.dispatchEvent(new CustomEvent("frak:client"));
}

let dispose: (() => void) | undefined;

function start() {
    dispose = autoMountRewardReminder();
}

async function flush() {
    await vi.advanceTimersByTimeAsync(10);
}

describe("autoMountRewardReminder", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("requestIdleCallback", undefined);
        window.FrakSetup.client = undefined;
    });

    afterEach(() => {
        dispose?.();
        dispose = undefined;
        vi.useRealTimers();
        vi.unstubAllGlobals();
        sdkConfigStore.clearCache();
        window.__frakSdkConfig = undefined;
        mountRewardReminder.mockReset();
    });

    it("mounts once the client is ready and the config resolved", async () => {
        start();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("mounts once even when both signals keep firing", async () => {
        start();
        readyClient();
        resolveConfig();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("waits for the client", async () => {
        start();
        resolveConfig();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("waits for the backend config", async () => {
        start();
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing for a hidden merchant", async () => {
        start();
        resolveConfig({ hidden: true });
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing when the dashboard disables it", async () => {
        start();
        resolveConfig({ enabled: false });
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing when the page config disables it", async () => {
        window.FrakSetup.config = { rewardReminder: { enabled: false } };
        start();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("mounts when a fresh config re-enables what a stale one disabled", async () => {
        start();
        resolveConfig({ enabled: false });
        readyClient();
        await flush();
        expect(mountRewardReminder).not.toHaveBeenCalled();

        resolveConfig();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("mounts when a fresh config unhides a merchant a stale one hid", async () => {
        start();
        resolveConfig({ hidden: true });
        readyClient();
        await flush();

        resolveConfig();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("prefers an idle slot over a timer", async () => {
        const idle = vi.fn((callback: () => void) => callback());
        vi.stubGlobal("requestIdleCallback", idle);

        start();
        resolveConfig();
        readyClient();
        await flush();

        expect(idle).toHaveBeenCalledTimes(1);
        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });
});
