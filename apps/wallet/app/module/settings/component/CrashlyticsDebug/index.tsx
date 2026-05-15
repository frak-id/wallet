import { isRunningInProd } from "@frak-labs/app-essentials";
import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { crashlytics } from "@frak-labs/wallet-shared";
import { Bug, FlameIcon } from "lucide-react";
import { useCallback } from "react";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

/**
 * Crashlytics smoke-test card.
 *
 * Renders two rows that intentionally crash the current session so the
 * Crashlytics dashboard end-to-end pipeline can be verified on TestFlight /
 * Play Internal builds (matching signing identity → matching dSYM/mapping
 * upload).
 *
 * Visible only outside production AND inside Tauri (mobile shell). On the
 * web build the `crashlytics` facade is `undefined`, so even if the dev
 * variant of the SPA is opened in a browser these rows do nothing.
 *
 * After tapping:
 *  - "Test native crash" → `Crashlytics.crashlytics()` SIGABRT → app dies →
 *    relaunch → fatal report appears in the dashboard within ~1 minute.
 *  - "Test Rust panic" → `panic!()` on the Rust side. Release builds also
 *    die (panic = "abort"), so the dashboard gets BOTH a fatal native
 *    report AND a non-fatal `RustPanic` issue on the next launch. Dev
 *    builds only get the non-fatal.
 */
export function CrashlyticsDebug() {
    const handleNativeCrash = useCallback(() => {
        void crashlytics?.testCrashNative();
    }, []);

    const handleRustPanic = useCallback(() => {
        void crashlytics?.testRustPanic();
    }, []);

    if (isRunningInProd) return null;
    if (!IS_TAURI) return null;
    if (!crashlytics) return null;

    return (
        <InfoCard variant="muted">
            <InfoRow
                icon={Bug}
                label="Crashlytics — test native crash"
                onClick={handleNativeCrash}
            />
            <InfoRow
                icon={FlameIcon}
                label="Crashlytics — test Rust panic"
                onClick={handleRustPanic}
            />
        </InfoCard>
    );
}
