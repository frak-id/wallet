/**
 * All the currencies available
 * @category Config
 */
export type Currency = "eur" | "usd" | "gbp";

/**
 * All the languages available
 * @category Config
 */
export type Language = "fr" | "en";

/**
 * Configuration for the Frak Wallet SDK
 * @category Config
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
        /**
         * The logo URL that will be displayed in a few components
         */
        logoUrl?: string;
        /**
         * The homepage link that could be displayed in a few components
         */
        homepageLink?: string;
    };
    /**
     * Some customization for the modal
     */
    customizations?: {
        /**
         * Custom CSS styles to apply to the modals and components
         */
        css?: `${string}.css`;
        /**
         * Custom i18n configuration for the modal
         */
        i18n?: I18nConfig;
    };
    /**
     * Campaign-specific i18n configurations
     * Key is the campaign ID, value is the i18n config for that campaign
     */
    campaignI18n?: Record<string, I18nConfig>;
    /**
     * The domain name of your application
     * @defaultValue window.location.host
     */
    domain?: string;
};

/**
 * Custom i18n configuration for the modal
 *  See [i18next json format](https://www.i18next.com/misc/json-format#i18next-json-v4)
 *
 * Available variables
 *  - `{{ productName }}` : The name of your website (`metadata.name`)
 *  - `{{ productOrigin }}` : The origin url of your website
 *  - `{{ estimatedReward }}` : The estimated reward for the user (based on the specific `targetInteraction` you can specify, or the max referrer reward if no target interaction is specified)
 *
 * Context of the translation [see i18n context](https://www.i18next.com/translation-function/context)
 *  - For modal display, the key of the final action (`sharing`, `reward`, or undefined)
 *  - For embedded wallet display, the key of the logged in action (`sharing` or undefined)
 *
 * @example
 * ```ts
 * // Multi language config
 * const multiI18n = {
 *  fr: {
 *      "sdk.modal.title": "Titre de modal",
 *      "sdk.modal.description": "Description de modal, avec {{ estimatedReward }} de gains possible",
 *  },
 *  en: "https://example.com/en.json"
 * }
 *
 * // Single language config
 * const singleI18n = {
 *      "sdk.modal.title": "Modal title",
 *      "sdk.modal.description": "Modal description, with {{ estimatedReward }} of gains possible",
 * }
 * ```
 *
 * @category Config
 */
export type I18nConfig =
    | Record<Language, LocalizedI18nConfig>
    | LocalizedI18nConfig;

/**
 * A localized i18n config
 * @category Config
 */
export type LocalizedI18nConfig = `${string}.css` | { [key: string]: string };
