import { fallbackLng, supportedLngs } from "@frak-labs/wallet-shared/i18n";

function supportedBase(tag: string | undefined): string | undefined {
    const base = tag?.split(/[-_]/)[0]?.toLowerCase();
    return base && supportedLngs.includes(base) ? base : undefined;
}

/**
 * The UI language as a bare `en`/`fr` tag, safe to hand to `Intl`.
 * `language` leads because `resolvedLanguage` stays on the bundled French
 * until a lazy English bundle lands.
 */
export function uiLanguage(i18n: {
    language?: string;
    resolvedLanguage?: string;
}): string {
    return (
        supportedBase(i18n.language) ??
        supportedBase(i18n.resolvedLanguage) ??
        fallbackLng
    );
}
