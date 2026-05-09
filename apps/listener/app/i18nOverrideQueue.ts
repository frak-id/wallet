/**
 * Vanilla i18n override queue.
 *
 * The eager bootstrap (Ring 0) doesn't load i18next or react-i18next, so
 * lifecycle messages from the SDK that want to mutate the i18n state
 * (`modal-i18n` overrides, `resolved-config.lang` language switches) need
 * a place to land before Ring 1 mounts.
 *
 * Ring 0 enqueues; Ring 1 drains exactly once on mount. After draining,
 * subsequent enqueues replay through the live i18n instance, so the queue
 * stays useful even after Ring 1 is up — though the common case is
 * everything queued runs in a single drain call.
 *
 * Keep this module dependency-free (only types from i18next/core-sdk).
 */

import type { I18nConfig, Language } from "@frak-labs/core-sdk";
import type { i18n as I18nType } from "i18next";

type OverrideEntry = { kind: "override"; payload: I18nConfig };
type LanguageEntry = { kind: "language"; payload: Language };
type Entry = OverrideEntry | LanguageEntry;

let activeI18n: I18nType | null = null;
const pending: Entry[] = [];

/**
 * Apply a single entry to a live i18n instance. Lazy-imports the heavy
 * `mapI18nConfig` mapper so Ring 0 only pays for it on actual override
 * arrival (in practice the overrides are rare).
 */
async function applyEntry(i18n: I18nType, entry: Entry): Promise<void> {
    if (entry.kind === "language") {
        if (i18n.language !== entry.payload) {
            await i18n.changeLanguage(entry.payload);
        }
        return;
    }

    const { mapI18nConfig } = await import("@/module/utils/i18nMapper");
    await mapI18nConfig(entry.payload, i18n);
}

/**
 * Enqueue an i18n config override (matches the `modal-i18n` SDK lifecycle
 * payload — string URL, localized record, or language map).
 */
export function enqueueI18nOverride(payload: I18nConfig): void {
    if (activeI18n) {
        void applyEntry(activeI18n, { kind: "override", payload });
        return;
    }
    pending.push({ kind: "override", payload });
}

/**
 * Enqueue a language switch (matches the `resolved-config.lang` SDK
 * lifecycle payload).
 */
export function enqueueLanguageChange(lang: Language): void {
    if (activeI18n) {
        void applyEntry(activeI18n, { kind: "language", payload: lang });
        return;
    }
    pending.push({ kind: "language", payload: lang });
}

/**
 * Bind the queue to a live i18n instance and drain everything that was
 * queued while Ring 1 was loading. Idempotent — calling twice with the
 * same instance is a no-op; switching instances re-binds and drains
 * whatever has accumulated since.
 *
 * Ring 1 calls this from `mountUiRuntime` after `i18next.init` resolves.
 */
export function drainPendingI18nOverrides(i18n: I18nType): void {
    activeI18n = i18n;
    if (pending.length === 0) return;
    const queued = pending.splice(0);
    for (const entry of queued) {
        void applyEntry(i18n, entry);
    }
}

/**
 * Test-only escape hatch.
 * todo: to be deleted
 */
export function _resetI18nOverrideQueueForTests(): void {
    activeI18n = null;
    pending.length = 0;
}
