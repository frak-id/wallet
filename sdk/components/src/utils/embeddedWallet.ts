import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { displayEmbeddedWallet } from "@frak-labs/core-sdk/actions";

export function openEmbeddedWallet(
    targetInteraction?: InteractionTypeKey,
    placement?: string
) {
    if (!window.FrakSetup?.client) {
        console.error("Frak client not found");
        return;
    }

    const modalWalletConfig = window.FrakSetup?.modalWalletConfig ?? {};

    displayEmbeddedWallet(
        window.FrakSetup.client,
        targetInteraction
            ? {
                  ...modalWalletConfig,
                  metadata: {
                      ...modalWalletConfig.metadata,
                      targetInteraction,
                  },
              }
            : modalWalletConfig,
        placement
    );
}
