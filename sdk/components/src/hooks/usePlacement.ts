import { type ResolvedPlacement, sdkConfigStore } from "@frak-labs/core-sdk";
import { useEffect, useState } from "preact/hooks";

export function usePlacement(
    placementId?: string
): ResolvedPlacement | undefined {
    const [placement, setPlacement] = useState<ResolvedPlacement | undefined>(
        () =>
            placementId ? sdkConfigStore.getPlacement(placementId) : undefined
    );

    useEffect(() => {
        if (!placementId) {
            setPlacement(undefined);
            return;
        }

        setPlacement(sdkConfigStore.getPlacement(placementId));

        return sdkConfigStore.subscribe((config) => {
            setPlacement(config.placements?.[placementId]);
        });
    }, [placementId]);

    return placement;
}
