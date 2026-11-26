/**
 * Vanilla i18n override queue.
 *
 * The eager bootstrap (Ring 0) doesn't load i18next or react-i18next, so
 * lifecycle messages from the SDK that want to mutate the i18n state
 * (`modal-i18n` overrides, `resolved-config.lang` language switches) need
 * a place to land before Ring 1 mounts.
 *
 * Ring 0 enqueues; Ring 1 drains exactly once on mount by handing over the
 * function that applies an entry to its i18n instance. After draining,
 * subsequent enqueues go straight to that function.
 *
 * Keep this module light: it only holds the entries, never the code that
 * applies them (that lives in `ui/applyI18nEntry.ts`, a Ring 1 chunk).
 */

import type { I18nConfig, Language } from "@frak-labs/core-sdk";

type OverrideEntry = { kind: "override"; payload: I18nConfig };
type LanguageEntry = { kind: "language"; payload: Language };
export type I18nEntry = OverrideEntry | LanguageEntry;
type ApplyI18nEntry = (entry: I18nEntry) => Promise<void>;

let apply: ApplyI18nEntry | null = null;
const pending: I18nEntry[] = [];

function dispatch(entry: I18nEntry): void {
    if (apply) {
        void apply(entry);
        return;
    }
    pending.push(entry);
}

/**
 * Enqueue an i18n config override (matches the `modal-i18n` SDK lifecycle
 * payload — string URL, localized record, or language map).
 */
export function enqueueI18nOverride(payload: I18nConfig): void {
    dispatch({ kind: "override", payload });
}

/**
 * Enqueue a language switch (matches the `resolved-config.lang` SDK
 * lifecycle payload).
 */
export function enqueueLanguageChange(lang: Language): void {
    dispatch({ kind: "language", payload: lang });
}

/**
 * Bind the queue to Ring 1's applier and drain, in order, everything queued
 * while Ring 1 was loading.
 *
 * Ring 1 calls this from `mountUiRuntime` after `i18next.init` resolves.
 */
export function drainPendingI18nOverrides(applyEntry: ApplyI18nEntry): void {
    apply = applyEntry;
    for (const entry of pending.splice(0)) {
        void applyEntry(entry);
    }
}

/**
 * Test-only escape hatch for the module-level queue state.
 */
export function _resetI18nOverrideQueueForTests(): void {
    apply = null;
    pending.length = 0;
}
