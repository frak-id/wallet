import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { useCallback, useMemo } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { openEmbeddedWallet } from "@/utils/embeddedWallet";
import { applyRewardPlaceholder } from "@/utils/formatReward";
import { openSharingPage } from "@/utils/sharingPage";
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
 * @see {@link @frak-labs/core-sdk!actions.displaySharingPage | `displaySharingPage()`} for more info about the sharing-page flow
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
    preview,
}: ButtonShareProps) {
    const isPreview = !!preview;
    const placement = usePlacement(placementId);
    const globalComponents = useGlobalComponents();
    const componentConfig =
        placement?.components?.buttonShare ?? globalComponents?.buttonShare;

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
        () => componentConfig?.clickAction ?? rawClickAction ?? "sharing-page",
        [componentConfig?.clickAction, rawClickAction]
    );
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        resolvedTargetInteraction
    );

    const btnText = useMemo(() => {
        if (!shouldUseReward) return resolvedText;
        if (!reward) {
            return (
                resolvedNoRewardText ??
                applyRewardPlaceholder(resolvedText, undefined)
            );
        }

        return resolvedText.includes("{REWARD}")
            ? applyRewardPlaceholder(resolvedText, reward)
            : `${resolvedText} ${reward}`;
    }, [shouldUseReward, resolvedText, resolvedNoRewardText, reward]);

    const onClick = useCallback(() => {
        if (isPreview) return;
        trackEvent(window.FrakSetup.client, "share_button_clicked", {
            placement: placementId,
            target_interaction: resolvedTargetInteraction,
            has_reward: Boolean(reward),
            click_action: resolvedClickAction,
        });
        if (resolvedClickAction === "embedded-wallet") {
            openEmbeddedWallet(resolvedTargetInteraction, placementId);
            return;
        }
        // Anything else (legacy `share-modal` configs included) routes to
        // the full-page sharing UI — the modal-flow share path was retired
        // in favour of `displaySharingPage` so every share surface goes
        // through the same UI.
        openSharingPage(resolvedTargetInteraction, placementId);
    }, [
        isPreview,
        resolvedClickAction,
        resolvedTargetInteraction,
        placementId,
        reward,
    ]);

    if (!isPreview && (!shouldRender || isHidden)) {
        return null;
    }

    const buttonClass = ["button", "button__fadeIn", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type={"button"}
            disabled={!isPreview && !isClientReady}
            class={buttonClass}
            onClick={onClick}
        >
            {btnText}
        </button>
    );
}
