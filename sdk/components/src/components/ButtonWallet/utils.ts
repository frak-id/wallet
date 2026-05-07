import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { openEmbeddedWallet } from "@/actions/embeddedWallet";
import { safeVibrate } from "@/utils/browser/safeVibrate";

export function openWalletModal(
    targetInteraction?: InteractionTypeKey,
    placement?: string
) {
    safeVibrate();
    openEmbeddedWallet(targetInteraction, placement);
}
