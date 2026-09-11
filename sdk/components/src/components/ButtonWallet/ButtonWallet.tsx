import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { useCallback } from "preact/hooks";
import { openSharingPage } from "@/actions/sharingPage";
import { useClientReady } from "@/hooks/useClientReady";
import { useLang } from "@/hooks/useLang";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { componentDefaults } from "@/i18n/defaults";
import { buildStyleContent } from "@/styles/sharedCss";
import { safeVibrate } from "@/utils/browser/safeVibrate";
import { WalletGiftIcon } from "./assets/WalletGiftIcon";
import type { ButtonWalletProps } from "./types";

const componentCss = `
.button {
    all: unset;
    position: fixed;
    bottom: 20px;
    z-index: 2000000;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #3e557e;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    cursor: pointer;
    text-align: center;
    font-size: 24px;
}

.button__left {
    left: 20px;
}

.button__right {
    right: 20px;
}

.reward {
    position: absolute;
    top: -4px;
    right: 27px;
    padding: 2px 3px;
    border-radius: 5px;
    background: #ff3f3f;
    font-size: 9px;
    color: #fff;
    font-weight: 600;
    white-space: nowrap;
    line-height: 9px;
}
`;

/**
 * Floating circular button that opens the Frak sharing page. The
 * `frak-button-wallet` tag name is public API (merchant markup, Magento
 * template), so it stays even though it no longer names the surface.
 *
 * @param args
 * @returns The wallet button with `<button>` tag
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-button-wallet></frak-button-wallet>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-button-wallet classname="button button-primary"></frak-button-wallet>
 * ```
 *
 * @example
 * Using reward information:
 * ```html
 * <frak-button-wallet use-reward></frak-button-wallet>
 * ```
 *
 * @example
 * Using reward information for specific reward:
 * ```html
 * <frak-button-wallet use-reward target-interaction="custom.customerMeeting"></frak-button-wallet>
 * ```
 *
 * @example
 * Using placement:
 * ```html
 * <frak-button-wallet placement="hero-wallet"></frak-button-wallet>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.displaySharingPage | `displaySharingPage()`} for more info about the sharing page
 * @see {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} for more info about the estimated reward fetching
 */
export function ButtonWallet({
    placement: placementId,
    classname = "",
    useReward: rawUseReward,
    targetInteraction,
}: ButtonWalletProps) {
    const lang = useLang();
    const placement = usePlacement(placementId);

    const resolvedTargetInteraction: InteractionTypeKey | undefined =
        placement?.targetInteraction !== undefined
            ? (placement.targetInteraction as InteractionTypeKey)
            : targetInteraction;

    const shouldUseReward = rawUseReward === true;
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        resolvedTargetInteraction
    );

    // `modalWalletConfig` is a merchant-injected config (Magento) and only its
    // position hint is still honoured.
    const position =
        placement?.components?.buttonWallet?.position ??
        window.FrakSetup?.modalWalletConfig?.metadata?.position ??
        "right";

    // Mirrors `<frak-button-share>`: both tags open the same surface, so both
    // must report the click or the sharing funnel loses its origin.
    const onClick = useCallback(() => {
        trackEvent(window.FrakSetup.client, "share_button_clicked", {
            placement: placementId,
            target_interaction: resolvedTargetInteraction,
            has_reward: Boolean(reward),
            click_action: "sharing-page",
        });
        safeVibrate();
        openSharingPage(resolvedTargetInteraction, placementId);
    }, [placementId, resolvedTargetInteraction, reward]);

    if (!shouldRender || isHidden) {
        return null;
    }

    const buttonClass = [
        "button",
        "button__fadeIn",
        position === "left" ? "button__left" : "button__right",
        classname,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <style>
                {buildStyleContent(
                    componentCss,
                    placement?.components?.buttonWallet?.css
                )}
            </style>
            <button
                type={"button"}
                aria-label={componentDefaults[lang].buttonWallet.ariaLabel}
                part="button"
                disabled={!isClientReady}
                class={buttonClass}
                onClick={onClick}
            >
                <WalletGiftIcon />
                {reward && <span class="reward">{reward}</span>}
            </button>
        </>
    );
}
