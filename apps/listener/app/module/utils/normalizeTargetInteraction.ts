import type { InteractionTypeKey } from "@frak-labs/core-sdk";

export function normalizeTargetInteraction(
    value: string | undefined
): InteractionTypeKey | undefined {
    if (!value) return undefined;
    return value as InteractionTypeKey;
}
