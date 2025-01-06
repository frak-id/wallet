import { getProductInformation } from "@core/actions";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { getModalBuilderSteps, onClientReady } from "../utils";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
export type ButtonShareProps = {
    /**
     * Text to display on the button
     *  - To specify where the reward should be displayed, use the placeholder `{REWARD}`, e.g. `Share and earn up to {REWARD}!`
     * @defaultValue `"Share and earn!"`
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Do we display the reward on the share modal?
     * @defaultValue `false`
     */
    useReward?: boolean;
    /**
     * Fallback text if the reward isn't found
     */
    noRewardText?: string;
};

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
function modalShare() {
    const modalBuilderSteps = getModalBuilderSteps();

    if (!modalBuilderSteps) {
        console.error("modalBuilderSteps not found");
        return;
    }

    modalBuilderSteps
        .sharing(window.FrakSetup?.modalShareConfig ?? {})
        .display();
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
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonShare({
    text = "Share and earn!",
    classname = "",
    useReward: rawUseReward,
    noRewardText,
}: ButtonShareProps) {
    const useReward = useMemo(() => rawUseReward !== undefined, [rawUseReward]);

    const [disabled, setDisabled] = useState(true);
    const [reward, setReward] = useState<string | undefined>(undefined);

    /**
     * Once the client is ready, enable the button and fetch the reward if needed
     */
    const handleClientReady = useCallback(() => {
        // Enable the btn
        setDisabled(false);

        if (!useReward) return;

        // Get the client
        const client = window.FrakSetup?.client;
        if (!client) {
            console.warn("Frak client not ready yet");
            return;
        }
        // Find the estimated reward
        getProductInformation(client).then((info) => {
            if (!info?.estimatedEurReward) return;
            setReward(`${info.estimatedEurReward} €`);
        });
    }, [useReward]);

    /**
     * Setup our client listener
     */
    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    /**
     * Compute the text we will display
     */
    const btnText = useMemo(() => {
        if (!useReward) return text;
        if (!reward) return noRewardText ?? text.replace("{REWARD}", "");

        // Here if we have a reward
        // Check if the text contain a REWARD placeholder, otherwise, put the reward at the end
        return text.includes("{REWARD}")
            ? text.replace("{REWARD}", reward)
            : `${text} ${reward}`;
    }, [useReward, text, noRewardText, reward]);

    return (
        <button
            type={"button"}
            class={classname}
            disabled={disabled}
            onClick={modalShare}
        >
            {btnText}
        </button>
    );
}
