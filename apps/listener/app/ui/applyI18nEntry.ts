import type { i18n as I18nType } from "i18next";
import type { I18nEntry } from "@/i18nOverrideQueue";
import { ensureI18nBundle } from "@/i18nPreload";
import { mapI18nConfig } from "@/module/utils/i18nMapper";

/**
 * Apply a queued SDK i18n entry to a live i18n instance.
 */
export async function applyI18nEntry(
    i18n: I18nType,
    entry: I18nEntry
): Promise<void> {
    if (entry.kind === "language") {
        if (i18n.language !== entry.payload) {
            // Before the switch, not after: `languageChanged` repaints the tree,
            // and react-i18next does not listen for a bundle registered later.
            await ensureI18nBundle(entry.payload, i18n);
            await i18n.changeLanguage(entry.payload);
        }
        return;
    }
    await mapI18nConfig(entry.payload, i18n);
}
