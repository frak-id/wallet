/**
 * The different type of action we can have on the embedded view (once the user is logged in)
 *
 * @group Embedded wallet
 */
export type EmbeddedViewAction = {
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
         * Can contain the variable {LINK} to specify where the link is placed, otherwise it will be added at the end
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
 * Some configuration options for the embedded view
 *
 * @group Embedded wallet
 */
export type LoggedInEmbeddedView = {
    /**
     * The main action to display on the logged in embedded view
     *  If none specified, the user will see his wallet with the activation button
     */
    action?: EmbeddedViewAction;
};
