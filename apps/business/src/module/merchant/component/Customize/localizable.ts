import type { LocalizableString } from "@frak-labs/backend-elysia/domain/merchant";
import type { Language } from "@frak-labs/core-sdk";
import type { LocalizedText, WordingLang } from "./types";

/**
 * Stored config value -> editable tier inputs. A bare string loads into the
 * `default` tier (a bare `LocalizableString` is language-agnostic); a tiered
 * map loads each tier as-is. Kept in sync with {@link fromLocalizedText}.
 */
export function toLocalizedText(
    value: LocalizableString | undefined
): LocalizedText {
    if (value === undefined) return { default: "", en: "", fr: "" };
    if (typeof value === "string") return { default: value, en: "", fr: "" };
    return {
        default: value.default ?? "",
        en: value.en ?? "",
        fr: value.fr ?? "",
    };
}

/**
 * Editable tier inputs -> stored config value. Returns `undefined` when nothing
 * is set (clears the field), a bare string when only the `default` tier is set
 * (compact, language-agnostic, backward compatible), otherwise a tiered map of
 * the non-empty tiers. Kept in sync with {@link toLocalizedText}.
 */
export function fromLocalizedText(
    text: LocalizedText
): LocalizableString | undefined {
    const defaultValue = text.default.trim();
    const en = text.en.trim();
    const fr = text.fr.trim();

    if (!defaultValue && !en && !fr) return undefined;
    if (defaultValue && !en && !fr) return defaultValue;

    return {
        ...(defaultValue && { default: defaultValue }),
        ...(en && { en }),
        ...(fr && { fr }),
    };
}

/**
 * Preview wording for a tab: backend `resolveLocalizable` cascade (selected tier
 * -> default -> en -> fr), then the SDK built-in default. `||` not `??` because a
 * blank tier (empty string) means "not set".
 */
export function resolvePreviewWording(
    value: LocalizedText,
    lang: WordingLang,
    builtInDefault: string
): string {
    return (
        value[lang] || value.default || value.en || value.fr || builtInDefault
    );
}

/**
 * Language used to look up the SDK built-in default. `en`/`fr` map directly; the
 * language-agnostic `default` tab borrows the merchant's identity language,
 * falling back to English like the SDK's `useLang`.
 */
export function resolveBuiltInLang(
    lang: WordingLang,
    configLang: Language | null | undefined
): Language {
    if (lang === "en" || lang === "fr") return lang;
    return configLang ?? "en";
}
