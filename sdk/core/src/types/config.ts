/**
 * All the currencies available
 */
export type Currency = "eur" | "usd" | "gbp";

/**
 * Configuration for the Nexus Wallet SDK
 */
export type FrakWalletSdkConfig = {
    /**
     * The Frak wallet url
     * @defaultValue "https://wallet.frak.id"
     */
    walletUrl?: string;
    /**
     * Some metadata about your implementation of the Frak SDK
     */
    metadata: {
        /**
         * Your application name (will be displayed in a few modals and in SSO)
         */
        name: string;
        /**
         * Custom CSS styles to apply to the modals and components
         */
        css?: string;
        /**
         * Language to display in the modal
         * If undefined, will default to the browser language
         */
        lang?: "fr" | "en";
        /**
         * The currency to display in the modal
         * @defaultValue `"eur"`
         */
        currency?: Currency;
    };
    /**
     * The domain name of your application
     * @defaultValue window.location.host
     */
    domain?: string;
};
