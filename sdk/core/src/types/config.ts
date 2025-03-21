/**
 * All the currencies available
 */
export type Currency = "eur" | "usd" | "gbp";

/**
 * All the languages available
 */
export type Language = "fr" | "en";

/**
 * Configuration for the Nexus Wallet SDK
 */
export type FrakWalletSdkConfig = {
    /**
     * The Frak wallet url
     * @defaultValue "https://wallet.frak.id"
     */
    walletUrl?: string;
    /**
     * Some metadata about your implementation of the Frak SDK
     */
    metadata: {
        /**
         * Your application name (will be displayed in a few modals and in SSO)
         */
        name: string;
        /**
         * Language to display in the modal
         * If undefined, will default to the browser language
         */
        lang?: Language;
        /**
         * The currency to display in the modal
         * @defaultValue `"eur"`
         */
        currency?: Currency;
    };
    /**
     * Some customization for the modal
     */
    customizations?: {
        /**
         * Custom CSS styles to apply to the modals and components
         */
        css?: string;
        /**
         * Custom i18n configuration for the modal
         *  See [i18next json format](https://www.i18next.com/misc/json-format#i18next-json-v4)
         *
         * Available context variables
         *  - `{{ productName }}` : The name of your website (`metadata.name`)
         *  - `{{ productOrigin }}` : The origin url of your website
         *  - `{{ estimatedReward }}` : The estimated reward for the user (based on the specific `targetInteraction` you can specify, or the max referrer reward if no target interaction is specified)
         *
         * @example
         * {
         *  fr: {
         *      "sdk.modal.title": "Titre de modal",
         *      "sdk.modal.description": "Description de modal, avec {{ estimatedReward }} de gains possible",
         *  },
         *  en: "https://example.com/en.json"
         * }
         */
        i18n?: I18nConfig;
    };
    /**
     * The domain name of your application
     * @defaultValue window.location.host
     */
    domain?: string;
};

/**
 * Configuration for the i18n of the modal
 * The key is the language and the value is either an url to a json file containing key-value pairs or an object of key-value pairs
 *
 * @example
 * {
 *  fr: {
 *      "sdk.modal.title": "Titre de modal",
 *  },
 *  en: "https://example.com/en.json"
 * }
 */
export type I18nConfig = Record<Language, string | { [key: string]: string }>;
