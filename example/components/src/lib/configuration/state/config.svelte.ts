/**
 * The configuration of the Frak SDK
 */
export const config = $state<{
    metadata: {
        name: string;
        lang?: string;
        currency?: string;
        logoUrl?: string;
        homepageLink?: string;
    };
    customizations: {
        i18n: Record<
            string,
            {
                [key: string]: string;
            }
        >;
    };
}>({
    metadata: {
        name: "",
        lang: "auto",
        currency: "eur",
    },
    customizations: {
        i18n: {},
    },
});
