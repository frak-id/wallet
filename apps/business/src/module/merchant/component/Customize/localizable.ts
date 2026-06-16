import type { LocalizableString } from "@frak-labs/backend-elysia/domain/merchant";
import { type LocalizedText, SUPPORTED_WORDING_LANGS } from "./types";

function blankLocalizedText(): LocalizedText {
    return Object.fromEntries(
        SUPPORTED_WORDING_LANGS.map((lang) => [lang, ""])
    ) as LocalizedText;
}

/**
 * Stored config value -> per-language form inputs. A bare string is mirrored
 * into every language input (legacy single-language configs stay editable);
 * a tiered map fills each language and falls back to `default` when missing.
 */
export function toLocalizedText(
    value: LocalizableString | undefined
): LocalizedText {
    if (value === undefined) return blankLocalizedText();
    if (typeof value === "string") {
        return Object.fromEntries(
            SUPPORTED_WORDING_LANGS.map((lang) => [lang, value])
        ) as LocalizedText;
    }
    const result = blankLocalizedText();
    for (const lang of SUPPORTED_WORDING_LANGS) {
        result[lang] = value[lang] ?? value.default ?? "";
    }
    return result;
}

/**
 * Per-language form inputs -> stored config value. Returns `undefined` when
 * nothing is set (clears the field), a single bare string when every language
 * is identical (compact, language-agnostic), otherwise a tiered map of the
 * non-empty languages.
 */
export function fromLocalizedText(
    text: LocalizedText
): LocalizableString | undefined {
    const entries = SUPPORTED_WORDING_LANGS.map(
        (lang) => [lang, text[lang].trim()] as const
    ).filter(([, value]) => value.length > 0);

    if (entries.length === 0) return undefined;

    const allLanguagesSet = entries.length === SUPPORTED_WORDING_LANGS.length;
    const allIdentical = entries.every(([, value]) => value === entries[0][1]);
    if (allLanguagesSet && allIdentical) return entries[0][1];

    return Object.fromEntries(entries) as LocalizableString;
}
