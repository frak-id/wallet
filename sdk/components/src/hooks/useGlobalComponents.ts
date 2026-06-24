import { type ResolvedPlacement, sdkConfigStore } from "@frak-labs/core-sdk";
import { useSyncExternalStore } from "preact/compat";
import { subscribeSdkConfig } from "./sdkConfigSubscription";

/**
 * Subscribe to the global component defaults from the SDK config store.
 * These serve as fallbacks when no placement-level override exists.
 *
 * Backed by `useSyncExternalStore`: the snapshot is the stored `components`
 * object reference (stable between `frak:config` dispatches), so the component
 * only re-renders when the global components actually change.
 */
export function useGlobalComponents():
    | ResolvedPlacement["components"]
    | undefined {
    return useSyncExternalStore(
        subscribeSdkConfig,
        () => sdkConfigStore.getConfig().components
    );
}
