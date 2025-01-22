/**
 * The different type of action we can have on the embeded view (once the user is logged in)
 *
 * @group Embeded wallet
 */
export type EmbededViewAction = {
    key: "sharing";

    /**
     * Some sharing options
     */
    options?: {
        /**
         * The title that will be displayed on the system popup once the system sharing window is open
         */
        popupTitle?: string;
        /**
         * The text that will be shared alongside the link.
         * Can contain the variable {LINK} to specify where the link is placed, otherwise it will be added at the end
         */
        text?: string;
        /**
         * The link to be shared (will be suffixed with the Frak sharing context)
         */
        link?: string;
    };
};

/**
 * Some configuration options for the embeded view
 *
 * @group Embeded wallet
 */
export type LoggedInEmbededView = {
    /**
     * The main action to display on the logged in embeded view
     *  If none specified, the user will see his wallet with the activation button
     */
    action?: EmbededViewAction;
};
