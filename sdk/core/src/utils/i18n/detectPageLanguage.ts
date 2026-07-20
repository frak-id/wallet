import type { Language } from "../../types/config";

/** Normalize a raw locale string (e.g. `"fr-FR"`) to a supported {@link Language}. */
function normalize(raw: string | undefined | null): Language | undefined {
    const base = raw?.split("-")[0]?.toLowerCase();
    return base === "en" || base === "fr" ? base : undefined;
}

/**
 * Best-effort detection of the page's intended content language for SDK copy.
 *
 * Precedence: the document's declared `<html lang>` (the page author's explicit
 * content language) → the browser UI language (`navigator.language`). Returns
 * `undefined` when neither resolves to a supported language, letting callers
 * apply their own fallback (e.g. `"en"`).
 *
 * The `<html lang>` check comes first so a page authored in French renders
 * French SDK copy even when the visitor's browser is set to another language.
 */
export function detectPageLanguage(): Language | undefined {
    const htmlLang =
        typeof document !== "undefined"
            ? normalize(document.documentElement.lang)
            : undefined;
    if (htmlLang) return htmlLang;

    return typeof navigator !== "undefined"
        ? normalize(navigator.language)
        : undefined;
}
