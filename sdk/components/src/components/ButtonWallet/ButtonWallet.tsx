import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { buildStyleContent } from "@/utils/sharedCss";
import { GiftIcon } from "./assets/GiftIcon";
import type { ButtonWalletProps } from "./types";
import { openWalletModal } from "./utils";

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
 * Button to open wallet modal
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
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} for more info about the estimated reward fetching
 */
export function ButtonWallet({
    placement: placementId,
    classname = "",
    useReward: rawUseReward,
    targetInteraction,
}: ButtonWalletProps) {
    const placement = usePlacement(placementId);

    const resolvedTargetInteraction = useMemo<InteractionTypeKey | undefined>(
        () =>
            placement?.targetInteraction !== undefined
                ? (placement.targetInteraction as InteractionTypeKey)
                : targetInteraction,
        [placement?.targetInteraction, targetInteraction]
    );

    const shouldUseReward = useMemo(
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        resolvedTargetInteraction
    );
    const [position, setPosition] = useState<"left" | "right">("right");

    useEffect(() => {
        const placementPosition = placement?.components?.buttonWallet?.position;
        const configPosition =
            window.FrakSetup?.modalWalletConfig?.metadata?.position;
        setPosition(placementPosition ?? configPosition ?? "right");
    }, [placement?.components?.buttonWallet?.position]);

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
                aria-label="Open wallet"
                part="button"
                disabled={!isClientReady}
                class={buttonClass}
                onClick={() => {
                    trackEvent(
                        window.FrakSetup.client,
                        "wallet_button_clicked"
                    );
                    openWalletModal(resolvedTargetInteraction, placementId);
                }}
            >
                <GiftIcon />
                {reward && <span class="reward">{reward}</span>}
            </button>
        </>
    );
}
