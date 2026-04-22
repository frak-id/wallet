import {
    DebugInfoGatherer,
    type InteractionTypeKey,
    trackEvent,
} from "@frak-labs/core-sdk";
import { modalBuilder } from "@frak-labs/core-sdk/actions";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { useCallback, useState } from "preact/hooks";

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal, lazily creating a modal builder on demand.
 */
export function useShareModal(
    targetInteraction?: InteractionTypeKey,
    placement?: string,
    sharingLink?: string
) {
    const [debugInfo, setDebugInfo] = useState<string | undefined>(undefined);
    const [isError, setIsError] = useState(false);

    const handleShare = useCallback(async () => {
        if (!window.FrakSetup?.client) {
            console.error("Frak client not found");
            setDebugInfo(
                DebugInfoGatherer.empty().formatDebugInfo(
                    "Frak client not found"
                )
            );
            setIsError(true);
            return;
        }

        const builder = modalBuilder(window.FrakSetup.client, {});

        try {
            await builder
                .sharing(sharingLink ? { link: sharingLink } : {})
                .display(
                    (metadata) => ({ ...metadata, targetInteraction }),
                    placement
                );
        } catch (e) {
            if (
                e instanceof FrakRpcError &&
                e.code === RpcErrorCodes.clientAborted
            ) {
                console.debug("User aborted the modal");
                return;
            }

            const debugInfo =
                window.FrakSetup.client.debugInfo.formatDebugInfo(e);

            // Track the error
            trackEvent(window.FrakSetup.client, "share_modal_error", {
                placement,
                target_interaction: targetInteraction,
                error:
                    e instanceof Object && "message" in e
                        ? (e.message as string)
                        : "Unknown error",
            });

            setDebugInfo(debugInfo);
            setIsError(true);
            console.error("Error while opening the modal", e);
        }
    }, [targetInteraction, placement, sharingLink]);

    return { handleShare, isError, debugInfo };
}
