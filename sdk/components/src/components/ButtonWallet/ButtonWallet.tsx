import { useClientReady } from "@/hooks/useClientReady";
import { useReward } from "@/hooks/useReward";
import { cx } from "class-variance-authority";
import { useEffect, useMemo, useState } from "preact/hooks";
import styles from "./ButtonWallet.module.css";
import GiftIcon from "./assets/gift.svg";
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
 * <frak-button-wallet use-reward target-interaction="retail.customerMeeting"></frak-button-wallet>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonWallet({
    classname = "",
    useReward: rawUseReward,
    targetInteraction,
}: ButtonWalletProps) {
    const shouldUseReward = useMemo(
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const { isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        targetInteraction
    );
    const [position, setPosition] = useState<"left" | "right">("right");

    /**
     * Setup the position of the button
     */
    useEffect(() => {
        const position =
            window.FrakSetup?.modalWalletConfig?.metadata?.position;
        setPosition(position ?? "right");
    }, []);

    return (
        <button
            type={"button"}
            aria-label="Open wallet"
            class={cx(
                styles.button,
                position === "left"
                    ? styles.button__left
                    : styles.button__right,
                classname,
                "override"
            )}
            disabled={!isClientReady}
            onClick={() => {
                window.FrakSetup.client?.openPanel?.track(
                    "wallet_button_clicked"
                );
                openWalletModal();
            }}
        >
            <GiftIcon />
            {reward && <span className={styles.reward}>{reward}</span>}
        </button>
    );
}
