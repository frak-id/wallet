/**
 * The props type for {@link OpenInAppButton}.
 * @inline
 */
export type OpenInAppButtonProps = {
    placement?: string;
    /**
     * Text to display on the button.
     *
     * When omitted, a built-in localized default is used based on the
     * resolved language (`"Open in App"` / `"Ouvrir dans l'app"`).
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
};
