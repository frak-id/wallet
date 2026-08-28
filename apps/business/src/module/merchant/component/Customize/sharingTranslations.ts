import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { LocalizedText, SharingWordingFormValues } from "./types";
import { SHARING_TRANSLATION_KEYS, SUPPORTED_WORDING_LANGS } from "./types";

type Translations = NonNullable<SdkConfig["translations"]>;

const SHARING_SLOTS = ["title", "text"] as const;

const EMPTY: LocalizedText = { default: "", en: "", fr: "" };

/**
 * Stored translations -> editable tier inputs. The two shapes are transposed:
 * storage nests tier -> key, the form nests key -> tier.
 */
export function translationsToSharingValues(
    translations: SdkConfig["translations"]
): SharingWordingFormValues {
    const read = (key: string): LocalizedText => {
        if (!translations) return { ...EMPTY };
        const entries = SUPPORTED_WORDING_LANGS.map((lang) => [
            lang,
            translations[lang]?.[key] ?? "",
        ]);
        return Object.fromEntries(entries) as LocalizedText;
    };
    return {
        title: read(SHARING_TRANSLATION_KEYS.title),
        text: read(SHARING_TRANSLATION_KEYS.text),
    };
}

/**
 * Editable tier inputs -> stored translations, preserving every key this form
 * does not own. A blank tier deletes its entry rather than storing `""`, which
 * i18next resolves as a real override. Empty returns `null`, never `undefined`:
 * `JSON.stringify` drops undefined and the route then keeps the old dictionary
 * (`sdkConfig.ts:55`), while `null` reaches its cleanup filter and deletes.
 */
export function sharingValuesToTranslations(
    values: SharingWordingFormValues,
    existing: SdkConfig["translations"]
): Translations | null {
    const next: Translations = {};

    for (const lang of SUPPORTED_WORDING_LANGS) {
        const overrides = { ...existing?.[lang] };
        for (const slot of SHARING_SLOTS) {
            const value = values[slot][lang].trim();
            if (value) {
                overrides[SHARING_TRANSLATION_KEYS[slot]] = value;
            } else {
                delete overrides[SHARING_TRANSLATION_KEYS[slot]];
            }
        }
        if (Object.keys(overrides).length > 0) next[lang] = overrides;
    }

    return Object.keys(next).length > 0 ? next : null;
}
