import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { openSharingPage } from "@/actions/sharingPage";
import { safeVibrate } from "@/utils/browser/safeVibrate";

/**
 * Open the sharing surface behind `<frak-button-wallet>`.
 *
 * The button used to open the embedded wallet drawer; that surface was
 * retired in favour of the full-page sharing UI, so the tag now routes
 * there like every other share CTA. The tag name is kept because it is
 * public API (merchant markup, Magento template).
 */
export function openWalletModal(
    targetInteraction?: InteractionTypeKey,
    placement?: string
) {
    safeVibrate();
    openSharingPage(targetInteraction, placement);
}
