import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";

export function valueOrNull(value: string): string | null {
    return value.trim() === "" ? null : value;
}

export function valueOrUndefined(value: string): string | undefined {
    return value.trim() === "" ? undefined : value;
}

export function getSdkConfig(
    sdkConfig: SdkConfig | null | undefined
): SdkConfig {
    return sdkConfig ?? {};
}

export function updatePlacement(
    sdkConfig: SdkConfig,
    placementId: string,
    update: (
        placement: NonNullable<NonNullable<SdkConfig["placements"]>[string]>
    ) => NonNullable<NonNullable<SdkConfig["placements"]>[string]>
) {
    const currentPlacements = sdkConfig.placements ?? {};
    const currentPlacement = currentPlacements[placementId] ?? {};

    return {
        ...currentPlacements,
        [placementId]: update(currentPlacement),
    };
}
