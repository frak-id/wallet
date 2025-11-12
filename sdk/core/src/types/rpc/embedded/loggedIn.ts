/**
 * The different type of action we can have on the embedded view (once the user is logged in)
 *
 * @group Embedded wallet
 */
export type EmbeddedViewActionSharing = {
    key: "sharing";

    /**
     * Some sharing options
     */
    options?: {
        /**
         * The title that will be displayed on the system popup once the system sharing window is open
         * @deprecated Use the top level `config.metadata.i18n` instead
         */
        popupTitle?: string;
        /**
         * The text that will be shared alongside the link.
         * Can contain the variable `{LINK}` to specify where the link is placed, otherwise it will be added at the end
         * @deprecated Use the top level `config.metadata.i18n` instead
         */
        text?: string;
        /**
         * The link to be shared (will be suffixed with the Frak sharing context)
         */
        link?: string;
    };
};

/**
 * The action to display on the logged out embedded view when the user is referred
 *
 * @group Embedded wallet
 */
export type EmbeddedViewActionReferred = {
    key: "referred";

    /**
     * No options for a referred action
     */
    options?: never;
};

/**
 * Some configuration options for the embedded view
 *
 * @group Embedded wallet
 */
export type LoggedInEmbeddedView = {
    /**
     * The main action to display on the logged in embedded view
     */
    action?: EmbeddedViewActionSharing | EmbeddedViewActionReferred;
};
