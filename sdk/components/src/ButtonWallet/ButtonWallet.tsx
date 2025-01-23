import { displayEmbededWallet } from "@frak-labs/core-sdk/actions";
import { useCallback, useEffect, useState } from "preact/hooks";
import { onClientReady, safeVibrate } from "../utils";
import GiftIcon from "./assets/gift.svg";

/**
 * The props type for {@link ButtonWallet}.
 * @inline
 */
export type ButtonWalletProps = {
    /**
     * Classname to apply to the button
     */
    classname?: string;
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
    displayEmbededWallet(window.FrakSetup.client, {});
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
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 */
export function ButtonWallet({ classname = "" }: ButtonWalletProps) {
    const [disabled, setDisabled] = useState(true);

    /**
     * Once the client is ready, enable the button
     */
    const handleClientReady = useCallback(() => {
        // Enable the btn
        setDisabled(false);
    }, []);

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
        </button>
    );
}
