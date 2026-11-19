import type { QueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { clearBootSplashStatus, setBootSplashStatus } from "@/utils/bootSplash";
import { otaUpdateQueryOptions } from "./otaUpdateQuery";
import { getOtaChannel } from "./otaUpdater";

const GATED_CHANNEL_KEY = "frak_ota_boot_gate_channel";

/** Past this the embedded bundle boots and the check carries on behind it. */
export const OTA_BOOT_GATE_TIMEOUT_MS = 8_000;

const STATUS_STEPS = [
    { afterMs: 300, key: "version.otaBoot.checking" },
    // An up-to-date answer is one small request: still running here means a bundle is downloading.
    { afterMs: 1_500, key: "version.otaBoot.downloading" },
] as const;

type StatusKey = (typeof STATUS_STEPS)[number]["key"];

export type OtaBootGateOutcome = "render" | "reload";

/**
 * Holds the first launch of each binary on the boot splash until its OTA check
 * settles, so a staged bundle boots before the app ever renders.
 */
export async function runOtaBootGate(
    queryClient: QueryClient
): Promise<OtaBootGateOutcome> {
    const channel = getOtaChannel();
    if (!channel || localStorage.getItem(GATED_CHANNEL_KEY) === channel) {
        return "render";
    }

    const stopStatus = showStatusWhileSlow();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
        queryClient.fetchQuery(otaUpdateQueryOptions).catch(() => undefined),
        new Promise<undefined>((resolve) => {
            timeout = setTimeout(
                () => resolve(undefined),
                OTA_BOOT_GATE_TIMEOUT_MS
            );
        }),
    ]);
    clearTimeout(timeout);
    stopStatus();
    localStorage.setItem(GATED_CHANNEL_KEY, channel);

    if (result?.status !== "staged") return "render";
    // The reloaded page starts without the line: fade it now rather than have it vanish.
    await clearBootSplashStatus();
    return "reload";
}

function showStatusWhileSlow(): () => void {
    let current: StatusKey | undefined;
    const render = () => {
        if (current) setBootSplashStatus(i18next.t(current));
    };
    const timers = STATUS_STEPS.map(({ afterMs, key }) =>
        setTimeout(() => {
            current = key;
            render();
        }, afterMs)
    );
    // The English bundle loads lazily and can land after the line was written.
    i18next.store.on("added", render);
    return () => {
        for (const timer of timers) clearTimeout(timer);
        i18next.store.off("added", render);
    };
}
