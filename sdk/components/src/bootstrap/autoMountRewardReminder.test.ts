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
        vi.useRealTimers();
        vi.unstubAllGlobals();
        sdkConfigStore.clearCache();
        window.__frakSdkConfig = undefined;
        mountRewardReminder.mockReset();
    });

    it("mounts once the client is ready and the config resolved", async () => {
        autoMountRewardReminder();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("mounts once even when both signals keep firing", async () => {
        autoMountRewardReminder();
        readyClient();
        resolveConfig();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });

    it("waits for the client", async () => {
        autoMountRewardReminder();
        resolveConfig();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("waits for the backend config", async () => {
        autoMountRewardReminder();
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing for a hidden merchant", async () => {
        autoMountRewardReminder();
        resolveConfig({ hidden: true });
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing when the dashboard disables it", async () => {
        autoMountRewardReminder();
        resolveConfig({ enabled: false });
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("loads nothing when the page config disables it", async () => {
        window.FrakSetup.config = { rewardReminder: { enabled: false } };
        autoMountRewardReminder();
        resolveConfig();
        readyClient();
        await flush();

        expect(mountRewardReminder).not.toHaveBeenCalled();
    });

    it("prefers an idle slot over a timer", async () => {
        const idle = vi.fn((callback: () => void) => callback());
        vi.stubGlobal("requestIdleCallback", idle);

        autoMountRewardReminder();
        resolveConfig();
        readyClient();
        await flush();

        expect(idle).toHaveBeenCalledTimes(1);
        expect(mountRewardReminder).toHaveBeenCalledTimes(1);
    });
});
