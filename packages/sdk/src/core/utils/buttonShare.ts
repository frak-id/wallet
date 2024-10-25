import type { NexusWalletSdkConfig } from "../types";

/**
 * Get the button share element
 * @param selector
 */
const getButtonShare = (selector = "#nexus-wallet-button"): Element | null =>
    document.querySelector(selector);

/**
 * Set the button opacity
 * @param opacity
 * @param button
 */
const setButtonOpacity = (opacity: number, button: Element | null) =>
    button?.setAttribute("style", `opacity: ${opacity};`);

/**
 * Toggle the button visibility
 * @param opacity
 */
const toggleButtonVisibility =
    (opacity: number) => (config?: NexusWalletSdkConfig) => {
        const button = getButtonShare(config?.metadata?.buttonShare);
        setButtonOpacity(opacity, button);
    };

/**
 * Show the button share
 */
export const showButtonShare = toggleButtonVisibility(1);

/**
 * Hide the button share
 */
export const hideButtonShare = toggleButtonVisibility(0);
