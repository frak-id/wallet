import i18next, { type ParseKeys } from "i18next";
import { loadEnglishBundle } from "@/i18n/loadBundle";

/**
 * Title and description shown in the Frak wallet window before the merchant
 * confirms. The title follows the dashboard language; the description carries
 * both languages because the wallet picks its own.
 */
export async function walletPromptMetadata({
    titleKey,
    descriptionKey,
}: {
    titleKey: ParseKeys;
    descriptionKey: ParseKeys;
}) {
    await loadEnglishBundle();
    return {
        header: { title: i18next.t(titleKey) },
        i18n: {
            fr: {
                "sdk.modal.sendTransaction.description": i18next.t(
                    descriptionKey,
                    { lng: "fr" }
                ),
            },
            en: {
                "sdk.modal.sendTransaction.description": i18next.t(
                    descriptionKey,
                    { lng: "en" }
                ),
            },
        },
    };
}
