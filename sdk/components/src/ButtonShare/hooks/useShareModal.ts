import { getModalBuilderSteps } from "@/utils/setup";
import {
    DebugInfoGatherer,
    FrakRpcError,
    type FullInteractionTypesKey,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { useCallback, useState } from "preact/hooks";

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
export function useShareModal(targetInteraction?: FullInteractionTypesKey) {
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

        const modalBuilderSteps = getModalBuilderSteps();

        if (!modalBuilderSteps) {
            throw new Error("modalBuilderSteps not found");
        }

        try {
            await modalBuilderSteps
                .sharing(window.FrakSetup?.modalShareConfig ?? {})
                .display((metadata) => ({
                    ...metadata,
                    targetInteraction,
                }));
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
            setDebugInfo(debugInfo);
            setIsError(true);
            console.error("Error while opening the modal", e);
        }
    }, [targetInteraction]);

    return { handleShare, isError, debugInfo };
}
