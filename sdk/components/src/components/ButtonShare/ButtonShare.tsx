import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { useCallback, useMemo } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { openEmbeddedWallet } from "@/utils/embeddedWallet";
import { ErrorMessage } from "./components/ErrorMessage";
import { useShareModal } from "./hooks/useShareModal";
import type { ButtonShareProps } from "./types";

/**
 * Button to share the current page
 *
 * @param args
 * @returns The share button with `<button>` tag
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-button-share></frak-button-share>
 * ```
 *
 * @example
 * Using a custom text:
 * ```html
 * <frak-button-share text="Share and earn!"></frak-button-share>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-button-share classname="button button-primary"></frak-button-share>
 * ```
 *
 * @example
 * Using reward information and fallback text:
 * ```html
 * <frak-button-share use-reward text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!"></frak-button-share>
 * ```
 *
 * @example
 * Using reward information for specific reward and fallback text:
 * ```html
 * <frak-button-share use-reward text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!" target-interaction="custom.customerMeeting"></frak-button-share>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} for more info about the estimated reward fetching
 */
export function ButtonShare({
    placement: placementId,
    text = "Share and earn!",
    classname = "",
    useReward: rawUseReward,
    noRewardText,
    targetInteraction,
    clickAction: rawClickAction,
}: ButtonShareProps) {
    const placement = usePlacement(placementId);
    const componentConfig = placement?.components?.buttonShare;

    useLightDomStyles("frak-button-share", placementId, componentConfig?.css);

    const resolvedTargetInteraction = useMemo<InteractionTypeKey | undefined>(
        () =>
            placement?.targetInteraction !== undefined
                ? (placement.targetInteraction as InteractionTypeKey)
                : targetInteraction,
        [placement?.targetInteraction, targetInteraction]
    );

    const resolvedText = componentConfig?.text ?? text;
    const resolvedNoRewardText = componentConfig?.noRewardText ?? noRewardText;

    const shouldUseReward = useMemo(
        () => componentConfig?.useReward ?? rawUseReward === true,
        [componentConfig?.useReward, rawUseReward]
    );
    const resolvedClickAction = useMemo(
        () =>
            componentConfig?.clickAction ?? rawClickAction ?? "embedded-wallet",
        [componentConfig?.clickAction, rawClickAction]
    );
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        resolvedTargetInteraction
    );
    const { handleShare, isError, debugInfo } = useShareModal(
        resolvedTargetInteraction,
        placementId
    );

    const btnText = useMemo(() => {
        if (!shouldUseReward) return resolvedText;
        if (!reward) {
            return resolvedNoRewardText ?? resolvedText.replace("{REWARD}", "");
        }

        return resolvedText.includes("{REWARD}")
            ? resolvedText.replace("{REWARD}", reward)
            : `${resolvedText} ${reward}`;
    }, [shouldUseReward, resolvedText, resolvedNoRewardText, reward]);

    const onClick = useCallback(async () => {
        trackEvent(window.FrakSetup.client, "share_button_clicked");
        if (resolvedClickAction === "share-modal") {
            await handleShare();
        } else {
            openEmbeddedWallet(resolvedTargetInteraction, placementId);
        }
    }, [
        resolvedClickAction,
        handleShare,
        resolvedTargetInteraction,
        placementId,
    ]);

    if (!shouldRender || isHidden) {
        return null;
    }

    const buttonClass = ["button", "button__fadeIn", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <button
                type={"button"}
                disabled={!isClientReady}
                class={buttonClass}
                onClick={onClick}
            >
                {btnText}
            </button>
            {isError && <ErrorMessage debugInfo={debugInfo} />}
        </>
    );
}
