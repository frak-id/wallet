import { type ResolvedPlacement, sdkConfigStore } from "@frak-labs/core-sdk";
import { useCallback } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";
import { subscribeSdkConfig } from "./sdkConfigSubscription";

function getPlacement(id: string): ResolvedPlacement | undefined {
    return sdkConfigStore.getConfig().placements?.[id];
}

/**
 * Subscribe to a single resolved placement from the SDK config store.
 *
 * Backed by `useSyncExternalStore`: the snapshot is the stored placement
 * object reference (stable between `frak:config` dispatches), so the component
 * only re-renders when that placement actually changes.
 */
export function usePlacement(
    placementId?: string
): ResolvedPlacement | undefined {
    const getSnapshot = useCallback(
        () => (placementId ? getPlacement(placementId) : undefined),
        [placementId]
    );
    return useSyncExternalStore(subscribeSdkConfig, getSnapshot);
}
