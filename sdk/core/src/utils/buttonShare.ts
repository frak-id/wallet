import type { FrakWalletSdkConfig } from "../types";

/**
 * Get the button share element
 * @param selector
 */
const getButtonShare = (
    selector = "button[data-frak-share-button], #nexus-share-button > button"
): NodeListOf<Element> => document.querySelectorAll(selector);

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
    (disabled: boolean) => (config?: FrakWalletSdkConfig) => {
        const buttons = Array.from(
            getButtonShare(config?.metadata?.buttonShare)
        );
        for (const button of buttons) {
            setButtonDisabled(disabled, button);
        }
    };

/**
 * Enable the button share
 */
export const enableButtonShare = toggleButtonDisabled(true);

/**
 * Disable the button share
 */
export const disableButtonShare = toggleButtonDisabled(false);
