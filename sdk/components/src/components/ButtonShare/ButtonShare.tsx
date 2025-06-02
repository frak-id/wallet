import { Spinner } from "@/components/Spinner";
import { useClientReady } from "@/hooks/useClientReady";
import { useReward } from "@/hooks/useReward";
import { displayEmbeddedWallet } from "@frak-labs/core-sdk/actions";
import { cx } from "class-variance-authority";
import { useCallback, useMemo } from "preact/hooks";
import styles from "./ButtonShare.module.css";
import { ErrorMessage } from "./components/ErrorMessage";
import { useShareModal } from "./hooks/useShareModal";
import type { ButtonShareProps } from "./types";

/**
 * Open the embedded wallet modal
 *
 * @description
 * This function will open the wallet modal with the configuration provided in the `window.FrakSetup.modalWalletConfig` object.
 */
async function modalEmbeddedWallet() {
    if (!window.FrakSetup?.client) {
        throw new Error("Frak client not found");
    }
    await displayEmbeddedWallet(
        window.FrakSetup.client,
        window.FrakSetup?.modalWalletConfig ?? {}
    );
}

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
 * <frak-button-share use-reward text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!" target-interaction="retail.customerMeeting"></frak-button-share>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonShare({
    text = "Share and earn!",
    classname = "",
    useReward: rawUseReward,
    noRewardText,
    targetInteraction,
    showWallet: rawShowWallet,
}: ButtonShareProps) {
    const shouldUseReward = useMemo(
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const showWallet = useMemo(
        () => rawShowWallet !== undefined,
        [rawShowWallet]
    );
    const { isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        targetInteraction
    );
    const { handleShare, isError, debugInfo } =
        useShareModal(targetInteraction);

    /**
     * Compute the text we will display
     */
    const btnText = useMemo(() => {
        if (!shouldUseReward) return text;
        if (!reward) return noRewardText ?? text.replace("{REWARD}", "");

        // Here if we have a reward
        // Check if the text contain a REWARD placeholder, otherwise, put the reward at the end
        return text.includes("{REWARD}")
            ? text.replace("{REWARD}", reward)
            : `${text} ${reward}`;
    }, [shouldUseReward, text, noRewardText, reward]);

    /**
     * The action when the button is clicked
     */
    const onClick = useCallback(async () => {
        window.FrakSetup?.client?.openPanel?.track("button_share_clicked");
        return await (showWallet ? modalEmbeddedWallet() : handleShare());
    }, [showWallet, handleShare]);

    return (
        <>
            <button
                type={"button"}
                className={cx(styles.buttonShare, classname, "override")}
                onClick={onClick}
            >
                {!isClientReady && <Spinner />} {btnText}
            </button>
            {isError && <ErrorMessage debugInfo={debugInfo} />}
        </>
    );
}
