import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { openEmbeddedWallet } from "@/utils/embeddedWallet";
import { safeVibrate } from "@/utils/safeVibrate";

export function openWalletModal(
    targetInteraction?: InteractionTypeKey,
    placement?: string
) {
    safeVibrate();
    openEmbeddedWallet(targetInteraction, placement);
}
