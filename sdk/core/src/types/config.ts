/**
 * Configuration for the Nexus Wallet SDK
 */
export type FrakWalletSdkConfig = Readonly<{
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
    };
    /**
     * The domain name of your application
     * @defaultValue window.location.host
     */
    domain?: string;
}>;
