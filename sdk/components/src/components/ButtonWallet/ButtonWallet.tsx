import { useClientReady } from "@/hooks/useClientReady";
import { useReward } from "@/hooks/useReward";
import { resolveI18nFromGlobalSetup } from "@/utils/i18nResolver";
import { safeVibrate } from "@/utils/safeVibrate";
import { trackEvent } from "@frak-labs/core-sdk";
import { displayEmbeddedWallet } from "@frak-labs/core-sdk/actions";
import { cx } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import styles from "./ButtonWallet.module.css";
import GiftIcon from "./assets/gift.svg";
import type { ButtonWalletProps } from "./types";

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
    campaignId,
    campaignI18n,
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

    /**
     * Open wallet modal with resolved i18n configuration
     */
    const openWalletModalWithI18n = useCallback(async () => {
        if (!window.FrakSetup?.client) {
            console.error("Frak client not found");
            return;
        }

        safeVibrate();

        // Resolve i18n configuration
        const resolvedI18n = resolveI18nFromGlobalSetup({
            campaignId,
            campaignI18n,
        });

        // Create modal config with resolved i18n
        const modalConfig = {
            ...window.FrakSetup?.modalWalletConfig,
            metadata: {
                ...window.FrakSetup?.modalWalletConfig?.metadata,
                ...(resolvedI18n && { i18n: resolvedI18n }),
            },
        };

        await displayEmbeddedWallet(window.FrakSetup.client, modalConfig);
    }, [campaignId, campaignI18n]);

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
                trackEvent(window.FrakSetup.client, "wallet_button_clicked");
                openWalletModalWithI18n();
            }}
        >
            <GiftIcon />
            {reward && <span className={styles.reward}>{reward}</span>}
        </button>
    );
}
