import {
    type InteractionTypeKey,
    type SharingPageProduct,
    sanitizeSharingProducts,
    trackEvent,
} from "@frak-labs/core-sdk";
import { useCallback, useMemo } from "preact/hooks";
import { openEmbeddedWallet } from "@/actions/embeddedWallet";
import { openSharingPage } from "@/actions/sharingPage";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLang } from "@/hooks/useLang";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { componentDefaults } from "@/i18n/defaults";
import { applyRewardPlaceholder } from "@/utils/format/formatReward";
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
 * Embedding the live reward amount. Include `{REWARD}` in `text` and the
 * SDK fetches + substitutes the estimated reward at render time. Provide
 * `no-reward-text` as a fallback when no reward is available:
 * ```html
 * <frak-button-share text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!"></frak-button-share>
 * ```
 *
 * @example
 * Same as above, scoped to a specific interaction type so the reward
 * estimate matches that flow:
 * ```html
 * <frak-button-share text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!" target-interaction="custom.customerMeeting"></frak-button-share>
 * ```
 *
 * @example
 * On a product page, pass the displayed product(s) so a `productScope`d
 * campaign matching one of them is advisorily preferred over a richer
 * campaign that doesn't apply, and so the sharing page (if opened) can
 * render product cards:
 * ```html
 * <frak-button-share text="Share and earn up to {REWARD}!" products='[{"title":"Shoes","sku":"SHOE-42","unitPrice":79.90}]'></frak-button-share>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.displaySharingPage | `displaySharingPage()`} for more info about the sharing-page flow
 * @see {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} for more info about the estimated reward fetching
 */
export function ButtonShare({
    placement: placementId,
    text,
    classname = "",
    noRewardText,
    targetInteraction,
    products,
    clickAction: rawClickAction,
    preview,
}: ButtonShareProps) {
    const isPreview = !!preview;
    const lang = useLang();
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

    const resolvedText =
        componentConfig?.text ??
        text ??
        componentDefaults[lang].buttonShare.text;
    const resolvedNoRewardText = componentConfig?.noRewardText ?? noRewardText;

    const wantsReward = useMemo(
        () => resolvedText.includes("{REWARD}"),
        [resolvedText]
    );
    const resolvedClickAction = useMemo(
        () => componentConfig?.clickAction ?? rawClickAction ?? "sharing-page",
        [componentConfig?.clickAction, rawClickAction]
    );
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    // Sanitized once here (not via a shared hook) — same inline-useMemo
    // pattern PostPurchase already used for its `products` prop. The array
    // feeds both reward selection below and the sharing-page RPC on click.
    const parsedProducts = useMemo<SharingPageProduct[] | undefined>(
        () => sanitizeSharingProducts(products),
        [products]
    );
    const { reward } = useReward(
        wantsReward && isClientReady,
        resolvedTargetInteraction,
        undefined,
        parsedProducts
    );

    const btnText = useMemo(() => {
        if (!wantsReward) return resolvedText;
        if (reward) return applyRewardPlaceholder(resolvedText, reward);
        return (
            resolvedNoRewardText ??
            applyRewardPlaceholder(resolvedText, undefined)
        );
    }, [wantsReward, resolvedText, resolvedNoRewardText, reward]);

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
        // through the same UI. Forward the same product context used for the
        // reward text above, so the sharing page can render product cards too.
        openSharingPage(resolvedTargetInteraction, placementId, {
            products: parsedProducts,
        });
    }, [
        isPreview,
        resolvedClickAction,
        resolvedTargetInteraction,
        placementId,
        reward,
        parsedProducts,
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
