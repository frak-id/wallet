/**
 * The view when a user is logged out
 * @group Embeded wallet
 */
export type LoggedOutEmbededView = {
    /**
     * Metadata option when displaying the embeded view
     */
    metadata?: {
        /**
         * The main CTA for the logged out view
         *  - can include some variable, available ones are:
         *      - {REWARD} -> The maximum reward a user can receive when itneracting on your website
         *  - can be formatted in markdown
         *
         * If not sert, it will default to a internalised message
         */
        text?: string;
        /**
         * The text that will be displayed on the login button
         *
         * If not set, it will default to a internalised message
         */
        buttonText?: string;
    };
};
