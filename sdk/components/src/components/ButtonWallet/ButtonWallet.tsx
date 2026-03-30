import { type InteractionTypeKey, trackEvent } from "@frak-labs/core-sdk";
import { cx } from "class-variance-authority";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { GiftIcon } from "./assets/GiftIcon";
import styles from "./ButtonWallet.module.css";
import type { ButtonWalletProps } from "./types";
import { openWalletModal } from "./utils";

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

    return (
        <button
            type={"button"}
            aria-label="Open wallet"
            disabled={!isClientReady}
            class={cx(
                styles.button,
                styles.button__fadeIn,
                position === "left"
                    ? styles.button__left
                    : styles.button__right,
                classname,
                "override"
            )}
            onClick={() => {
                trackEvent(window.FrakSetup.client, "wallet_button_clicked");
                openWalletModal(resolvedTargetInteraction, placementId);
            }}
        >
            <GiftIcon />
            {reward && <span className={styles.reward}>{reward}</span>}
        </button>
    );
}
