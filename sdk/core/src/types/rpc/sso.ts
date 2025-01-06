/**
 * SSO Metadata
 */
export type SsoMetadata = {
    /**
     * URL to your client, if provided will be displayed in the SSO header
     */
    logoUrl?: string;
    /**
     * Link to your homepage, if referenced your app name will contain a link on the sso page
     */
    homepageLink?: string;
    /**
     * A few links that will be displayed in the footer
     */
    links?: {
        /**
         * URL to your confidentiality page
         */
        confidentialityLink?: string;
        /**
         * URL to your help page
         */
        helpLink?: string;
        /**
         * URL to your CGU page
         */
        cguLink?: string;
    };
};

/**
 * Params to start a SSO
 * @group RPC Schema
 */
export type OpenSsoParamsType = {
    /**
     * Redirect URL after the SSO (optional)
     */
    redirectUrl?: string;
    /**
     * If the SSO should directly exit after completion
     * @defaultValue true
     */
    directExit?: boolean;
    /**
     * Language of the SSO page (optional)
     * It will default to the current user language (or "en" if unsupported language)
     */
    lang?: "en" | "fr";
    /**
     * Custom SSO metadata
     */
    metadata: SsoMetadata;
};
