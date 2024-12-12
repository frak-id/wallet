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
 */
export type OpenSsoParamsType = {
    redirectUrl?: string;
    directExit?: boolean;
    lang?: "en" | "fr";
    metadata: SsoMetadata;
};
