import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { displayEmbededWallet } from "@frak-labs/core-sdk/actions";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { getCurrentReward, onClientReady, safeVibrate } from "../utils";
import GiftIcon from "./assets/gift.svg?react";
import "./ButtonWallet.css";

/**
 * The props type for {@link ButtonWallet}.
 * @inline
 */
export type ButtonWalletProps = {
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Do we display the reward on the button?
     * @defaultValue `false`
     */
    useReward?: boolean;
    /**
     * Target interaction behind this sharing action (will be used to get the right reward to display)
     */
    targetInteraction?: FullInteractionTypesKey;
};

/**
 * Open the wallet modal
 *
 * @description
 * This function will open the wallet modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
function modalWallet() {
    if (!window.FrakSetup?.client) {
        console.error("Frak client not found");
        return;
    }
    safeVibrate();
    displayEmbededWallet(
        window.FrakSetup.client,
        window.FrakSetup?.modalWalletConfig ?? {}
    );
}

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
    const useReward = useMemo(() => rawUseReward !== undefined, [rawUseReward]);

    const [disabled, setDisabled] = useState(true);
    const [reward, setReward] = useState<string | undefined>(undefined);

    /**
     * Once the client is ready, enable the button
     */
    const handleClientReady = useCallback(() => {
        // Enable the btn
        setDisabled(false);

        if (!useReward) return;

        // Find the estimated reward
        getCurrentReward(targetInteraction).then((reward) => {
            if (!reward) return;
            setReward(`${reward}€`);
        });
    }, [useReward, targetInteraction]);

    /**
     * Setup our client listener
     */
    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    return (
        <button
            type={"button"}
            class={classname}
            disabled={disabled}
            onClick={modalWallet}
        >
            <GiftIcon />
            {reward && <span>{reward}</span>}
        </button>
    );
}
