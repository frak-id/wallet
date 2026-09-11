import { isRunningInProd } from "@frak-labs/app-essentials";
import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { crashlytics } from "@frak-labs/wallet-shared";
import { Bug, FlameIcon } from "lucide-react";
import { useCallback } from "react";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

/**
 * Crashlytics smoke-test card — both rows intentionally kill the session.
 * "Test native crash" reports as fatal on the next launch; "Test Rust panic"
 * reports as fatal AND non-fatal `RustPanic` in release (panic = "abort"),
 * non-fatal only in dev.
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
