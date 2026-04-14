import type { ResolvedPlacement } from "@frak-labs/core-sdk";
import { type SdkResolvedConfig, sdkConfigStore } from "@frak-labs/core-sdk";
import { useEffect, useMemo, useState } from "preact/hooks";

/**
 * Subscribe to the global component defaults from the SDK config store.
 * These serve as fallbacks when no placement-level override exists.
 */
export function useGlobalComponents():
    | ResolvedPlacement["components"]
    | undefined {
    const [configVersion, setConfigVersion] = useState(0);

    useEffect(() => {
        const onConfig = (_e: CustomEvent<SdkResolvedConfig>) => {
            setConfigVersion((v) => v + 1);
        };
        window.addEventListener("frak:config", onConfig);
        setConfigVersion((v) => v + 1);
        return () => window.removeEventListener("frak:config", onConfig);
    }, []);

    return useMemo(
        () => sdkConfigStore.getConfig().components,
        [configVersion]
    );
}
