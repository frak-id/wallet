import type { NexusWalletSdkConfig } from "../types";

/**
 * Get the button share element
 * @param selector
 */
const getButtonShare = (
    selector = "#nexus-share-button > button"
): Element | null => document.querySelector(selector);

/**
 * Set the button disabled
 * @param disabled
 * @param button
 */
const setButtonDisabled = (disabled: boolean, button: Element | null) => {
    if (disabled) {
        button?.removeAttribute("disabled");
        return;
    }
    button?.setAttribute("disabled", "");
};

/**
 * Toggle the button attribute disabled
 * @param disabled
 */
const toggleButtonDisabled =
    (disabled: boolean) => (config?: NexusWalletSdkConfig) => {
        const button = getButtonShare(config?.metadata?.buttonShare);
        setButtonDisabled(disabled, button);
    };

/**
 * Enable the button share
 */
export const enableButtonShare = toggleButtonDisabled(true);

/**
 * Disable the button share
 */
export const disableButtonShare = toggleButtonDisabled(false);
