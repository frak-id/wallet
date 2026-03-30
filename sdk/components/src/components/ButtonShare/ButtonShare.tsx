import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { cx } from "class-variance-authority";
import { useCallback, useMemo } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { openEmbeddedWallet } from "@/utils/embeddedWallet";
import styles from "./ButtonShare.module.css";
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
    showWallet: rawShowWallet,
}: ButtonShareProps) {
    const placement = usePlacement(placementId);
    const componentConfig = placement?.components?.buttonShare;

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
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const showWallet = useMemo(
        () => componentConfig?.showWallet ?? rawShowWallet !== undefined,
        [componentConfig?.showWallet, rawShowWallet]
    );
    const { isClientReady, isHidden } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        resolvedTargetInteraction
    );
    const { handleShare, isError, debugInfo } = useShareModal(
        resolvedTargetInteraction,
        placementId
    );

    /**
     * Compute the text we will display
     */
    const btnText = useMemo(() => {
        if (!shouldUseReward) return resolvedText;
        if (!reward) {
            return resolvedNoRewardText ?? resolvedText.replace("{REWARD}", "");
        }

        // Here if we have a reward
        // Check if the text contain a REWARD placeholder, otherwise, put the reward at the end
        return resolvedText.includes("{REWARD}")
            ? resolvedText.replace("{REWARD}", reward)
            : `${resolvedText} ${reward}`;
    }, [shouldUseReward, resolvedText, resolvedNoRewardText, reward]);

    /**
     * The action when the button is clicked
     */
    const onClick = useCallback(async () => {
        trackEvent(window.FrakSetup.client, "share_button_clicked");
        if (showWallet) {
            openEmbeddedWallet(resolvedTargetInteraction, placementId);
        } else {
            await handleShare();
        }
    }, [showWallet, handleShare, resolvedTargetInteraction, placementId]);

    if (!isClientReady || isHidden) {
        return null;
    }

    return (
        <>
            <button
                type={"button"}
                className={cx(
                    styles.buttonShare,
                    styles.buttonShare__fadeIn,
                    classname,
                    "override"
                )}
                onClick={onClick}
            >
                {btnText}
            </button>
            {isError && <ErrorMessage debugInfo={debugInfo} />}
        </>
    );
}
