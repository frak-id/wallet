/**
 * SSO Metadata
 */
export type SsoMetadata = {
    logoUrl?: string;
    homepageLink?: string;
    links?: {
        confidentialityLink?: string;
        helpLink?: string;
        cguLink?: string;
    };
};

/**
 * Params to start a SSO
 * @group RPC Schema
 */
export type OpenSsoParamsType = {
    redirectUrl?: string;
    directExit?: boolean;
    lang?: "en" | "fr";
    metadata: SsoMetadata;
};
