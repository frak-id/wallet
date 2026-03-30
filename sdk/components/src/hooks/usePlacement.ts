import {
    type ResolvedPlacement,
    type SdkResolvedConfig,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import { useEffect, useMemo, useState } from "preact/hooks";

function getPlacement(id: string): ResolvedPlacement | undefined {
    return sdkConfigStore.getConfig().placements?.[id];
}

export function usePlacement(
    placementId?: string
): ResolvedPlacement | undefined {
    const [configVersion, setConfigVersion] = useState(0);

    useEffect(() => {
        const onConfig = (_e: CustomEvent<SdkResolvedConfig>) => {
            setConfigVersion((v) => v + 1);
        };
        window.addEventListener("frak:config", onConfig);
        // Re-check in case event fired between render and effect mount
        setConfigVersion((v) => v + 1);
        return () => window.removeEventListener("frak:config", onConfig);
    }, []);

    return useMemo(
        () => (placementId ? getPlacement(placementId) : undefined),
        [placementId, configVersion]
    );
}
