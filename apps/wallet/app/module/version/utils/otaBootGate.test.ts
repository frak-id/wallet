import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { versionKey } from "../queryKeys/version";
import { OTA_BOOT_GATE_TIMEOUT_MS, runOtaBootGate } from "./otaBootGate";
import type { OtaUpdateResult } from "./otaUpdater";

const { getOtaChannelMock, stageOtaUpdateMock } = vi.hoisted(() => ({
    getOtaChannelMock: vi.fn(),
    stageOtaUpdateMock: vi.fn(),
}));

vi.mock("./otaUpdater", () => ({
    getOtaChannel: getOtaChannelMock,
    stageOtaUpdate: stageOtaUpdateMock,
}));

vi.mock("@frak-labs/wallet-shared", () => ({ recordError: vi.fn() }));

vi.mock("i18next", () => ({
    default: {
        t: (key: string) => key,
        store: { on: vi.fn(), off: vi.fn() },
    },
}));

const CHANNEL = "prod-ios-1-2-3";

function gatedChannel() {
    return localStorage.getItem("frak_ota_boot_gate_channel");
}

function resolveAfter(ms: number, result: OtaUpdateResult) {
    return new Promise<OtaUpdateResult>((resolve) =>
        setTimeout(() => resolve(result), ms)
    );
}

function statusText() {
    return document.querySelector(".boot-splash-text")?.textContent;
}

function statusVisible() {
    return document
        .querySelector(".boot-splash-status")
        ?.hasAttribute("data-visible");
}

describe("runOtaBootGate", () => {
    let client: QueryClient;

    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        client = new QueryClient();
        getOtaChannelMock.mockReset().mockReturnValue(CHANNEL);
        stageOtaUpdateMock.mockReset();
        document.body.innerHTML = `
            <div id="boot-splash">
                <div class="boot-splash-status"><p class="boot-splash-text"></p></div>
            </div>`;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("boots straight away where OTA does not apply", async () => {
        getOtaChannelMock.mockReturnValue(null);

        expect(await runOtaBootGate(client)).toBe("render");
        expect(stageOtaUpdateMock).not.toHaveBeenCalled();
    });

    it("reloads once the bundle is staged", async () => {
        stageOtaUpdateMock.mockResolvedValue({ status: "staged" });

        expect(await runOtaBootGate(client)).toBe("reload");
        expect(gatedChannel()).toBe(CHANNEL);
    });

    it("fades the status out before reloading", async () => {
        stageOtaUpdateMock.mockReturnValue(
            resolveAfter(2_000, { status: "staged" })
        );

        let outcome: string | undefined;
        void runOtaBootGate(client).then((value) => {
            outcome = value;
        });
        await vi.advanceTimersByTimeAsync(2_000);
        expect(statusVisible()).toBe(false);
        expect(statusText()).toBe("version.otaBoot.downloading");
        expect(outcome).toBeUndefined();

        await vi.advanceTimersByTimeAsync(250);
        expect(outcome).toBe("reload");
    });

    it("gates each binary only once", async () => {
        stageOtaUpdateMock.mockResolvedValue({ status: "up_to_date" });

        expect(await runOtaBootGate(client)).toBe("render");
        expect(await runOtaBootGate(new QueryClient())).toBe("render");
        expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);

        getOtaChannelMock.mockReturnValue("prod-ios-1-2-4");
        await runOtaBootGate(new QueryClient());
        expect(stageOtaUpdateMock).toHaveBeenCalledTimes(2);
    });

    it("boots the embedded bundle when the check fails", async () => {
        stageOtaUpdateMock.mockRejectedValue(new Error("offline"));

        expect(await runOtaBootGate(client)).toBe("render");
        expect(gatedChannel()).toBe(CHANNEL);
    });

    it("gives up at the cap and leaves the check running in the shared cache", async () => {
        stageOtaUpdateMock.mockReturnValue(
            resolveAfter(OTA_BOOT_GATE_TIMEOUT_MS + 5_000, {
                status: "staged",
            })
        );

        const outcome = runOtaBootGate(client);
        await vi.advanceTimersByTimeAsync(OTA_BOOT_GATE_TIMEOUT_MS);
        expect(await outcome).toBe("render");
        expect(gatedChannel()).toBe(CHANNEL);

        await vi.advanceTimersByTimeAsync(5_000);
        expect(client.getQueryData(versionKey.otaUpdate)).toEqual({
            status: "staged",
        });
        expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);
    });

    it("shows no status when the answer is quick", async () => {
        stageOtaUpdateMock.mockReturnValue(
            resolveAfter(250, { status: "up_to_date" })
        );

        const outcome = runOtaBootGate(client);
        await vi.advanceTimersByTimeAsync(250);
        await outcome;
        await vi.advanceTimersByTimeAsync(5_000);

        expect(statusText()).toBe("");
        expect(statusVisible()).toBe(false);
    });

    it("says it is checking, then downloading, while the check runs", async () => {
        stageOtaUpdateMock.mockReturnValue(
            resolveAfter(4_000, { status: "staged" })
        );

        const outcome = runOtaBootGate(client);
        await vi.advanceTimersByTimeAsync(299);
        expect(statusVisible()).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(statusText()).toBe("version.otaBoot.checking");
        expect(statusVisible()).toBe(true);

        await vi.advanceTimersByTimeAsync(1_200);
        expect(statusText()).toBe("version.otaBoot.downloading");

        await vi.advanceTimersByTimeAsync(2_750);
        expect(await outcome).toBe("reload");
    });

    it("leaves the status for the splash exit when it renders", async () => {
        stageOtaUpdateMock.mockReturnValue(
            resolveAfter(500, { status: "up_to_date" })
        );

        const outcome = runOtaBootGate(client);
        await vi.advanceTimersByTimeAsync(500);

        expect(await outcome).toBe("render");
        expect(statusVisible()).toBe(true);
        expect(statusText()).toBe("version.otaBoot.checking");
    });
});
