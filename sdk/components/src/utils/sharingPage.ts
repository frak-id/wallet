import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { displaySharingPage } from "@frak-labs/core-sdk/actions";

export async function openSharingPage(
    targetInteraction?: InteractionTypeKey,
    placement?: string
) {
    if (!window.FrakSetup?.client) {
        console.error("Frak client not found");
        return;
    }

    await displaySharingPage(
        window.FrakSetup.client,
        {
            metadata: {
                ...(targetInteraction && { targetInteraction }),
            },
        },
        placement
    );
}
