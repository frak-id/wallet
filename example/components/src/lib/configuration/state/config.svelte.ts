/**
 * The configuration of the Frak SDK
 */
export const config = $state<{
    metadata: {
        name: string;
        lang?: string;
        currency?: string;
    };
    customizations: {
        i18n: {
            en: Record<string, string>;
            fr: Record<string, string>;
        };
    };
}>({
    metadata: {
        name: "",
    },
    customizations: {
        i18n: {
            en: {},
            fr: {},
        },
    },
});
