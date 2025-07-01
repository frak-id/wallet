import { resolveI18nFromGlobalSetup } from "@/utils/i18nResolver";
import { getModalBuilderSteps } from "@/utils/setup";
import {
    type CampaignI18nConfig,
    DebugInfoGatherer,
    FrakRpcError,
    type FullInteractionTypesKey,
    RpcErrorCodes,
    trackEvent,
} from "@frak-labs/core-sdk";
import { useCallback, useState } from "preact/hooks";

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
export function useShareModal({
    targetInteraction,
    campaignId,
    campaignI18n,
}: {
    targetInteraction?: FullInteractionTypesKey;
    campaignId?: string;
    campaignI18n?: CampaignI18nConfig;
}) {
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
            // Resolve i18n configuration
            const resolvedI18n = resolveI18nFromGlobalSetup({
                campaignId,
                campaignI18n,
            });

            await modalBuilderSteps
                .sharing(window.FrakSetup?.modalShareConfig ?? {})
                .display((metadata) => ({
                    ...metadata,
                    targetInteraction,
                    ...(resolvedI18n && { i18n: resolvedI18n }),
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

            // Track the error
            trackEvent(window.FrakSetup.client, "share_modal_error", {
                error:
                    e instanceof Object && "message" in e
                        ? e.message
                        : "Unknown error",
                debugInfo,
            });

            setDebugInfo(debugInfo);
            setIsError(true);
            console.error("Error while opening the modal", e);
        }
    }, [targetInteraction, campaignId, campaignI18n]);

    return { handleShare, isError, debugInfo };
}
