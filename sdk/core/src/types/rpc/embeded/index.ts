import type { LoggedInEmbededView } from "./loggedIn";
import type { LoggedOutEmbededView } from "./loggedOut";

export type { EmbededViewAction } from "./loggedIn";
export type { LoggedInEmbededView, LoggedOutEmbededView };

/**
 * The params used to show the embeded wallet
 *
 * @group Embeded wallet
 */
export type ShowEmbededWalletParamsType = {
    /**
     * The embeded view to display once the user is logged in
     */
    loggedIn?: LoggedInEmbededView;
    /**
     * The embeded view to display once the user is logged out
     */
    loggedOut?: LoggedOutEmbededView;
    /**
     * Some metadata to customise the embeded view
     */
    metadata?: {
        /**
         * Language of the embeded wallet
         * If undefined, will default to the browser language
         */
        lang?: "fr" | "en";
        /**
         * The logo to display on the embeded wallet
         * If undefined, will default to no logo displayed
         */
        logo?: string;
        /**
         * Link to the homepage of the calling website
         * If unedfined, will default to the domain of the calling website
         */
        homepageLink?: string;
    };
};
