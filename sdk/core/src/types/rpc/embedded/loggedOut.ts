/**
 * The action to display on the logged out embedded view when the user is referred
 *
 * @group Embedded wallet
 */
export type EmbeddedViewActionReferred = {
    key: "referred";
};

/**
 * The view when a user is logged out
 * @group Embedded wallet
 */
export type LoggedOutEmbeddedView = {
    /**
     * The main action to display on the logged out embedded view
     */
    action?: EmbeddedViewActionReferred;

    /**
     * Metadata option when displaying the embedded view
     */
    metadata?: {
        /**
         * The main CTA for the logged out view
         *  - can include some variable, available ones are:
         *      - {REWARD} -> The maximum reward a user can receive when interacting on your website
         *  - can be formatted in markdown
         *
         * If not set, it will default to a internationalized message
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        text?: string;
        /**
         * The text that will be displayed on the login button
         *
         * If not set, it will default to a internationalized message
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        buttonText?: string;
    };
};
