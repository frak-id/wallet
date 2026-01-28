export type OpenInAppButtonProps = {
    /**
     * Text to display on the button
     * @defaultValue `"Open in App"`
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Action to perform when button is clicked
     * - "open": Just open the app (default)
     * - "login": Open the app and trigger login flow with redirect back
     * @defaultValue `"open"`
     */
    action?: "open" | "login";
    /**
     * Merchant ID for login action (required if action="login")
     * If not provided, will be computed from current domain
     */
    merchantId?: string;
};
