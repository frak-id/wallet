import type { Address } from "viem";
import type { FullInteractionTypesKey } from "../../../constants/interactionTypes";
import type { I18nConfig } from "../../config";
import type { LoggedInEmbededView } from "./loggedIn";
import type { LoggedOutEmbededView } from "./loggedOut";

export type { EmbededViewAction } from "./loggedIn";
export type { LoggedInEmbededView, LoggedOutEmbededView };

/**
 * The params used to display the embedded wallet
 *
 * @group Embedded wallet
 */
export type DisplayEmbededWalletParamsType = {
    /**
     * The embedded view to display once the user is logged in
     */
    loggedIn?: LoggedInEmbededView;
    /**
     * The embedded view to display once the user is logged out
     */
    loggedOut?: LoggedOutEmbededView;
    /**
     * Some metadata to customize the embedded view
     */
    metadata?: {
        /**
         * The logo to display on the embedded wallet
         * If undefined, will default to no logo displayed
         */
        logo?: string;
        /**
         * Link to the homepage of the calling website
         * If undefined, will default to the domain of the calling website
         */
        homepageLink?: string;
        /**
         * The target interaction behind this modal
         */
        targetInteraction?: FullInteractionTypesKey;
        /**
         * The position of the component
         */
        position?: "left" | "right";
        /**
         * Some i18n override for the displayed modal (i.e. update the displayed text only for this modal)
         */
        i18n?: I18nConfig;
    };
};

/**
 * The result of the display embedded wallet rpc request
 *
 * @group Embedded wallet
 */
export type DisplayEmbededWalletResultType = {
    wallet: Address;
};
