import type { ParseKeys } from "i18next";

/** The namespaces `resources.d.ts` declares. */
export type I18nNamespace = "translation" | "customized" | "common";

/**
 * A key that exists in the generated `Resources` interface.
 *
 * `Parameters<typeof t>[0]` looks equivalent and is not: `TFunction` is
 * overloaded, so `Parameters` collapses to the last signature, whose key is
 * `string`, and every key silently passes.
 */
export type TranslationKey<Namespace extends I18nNamespace = I18nNamespace> =
    ParseKeys<Namespace>;

/**
 * A `t` narrowed by a caller that injects interpolation values of its own.
 *
 * Defaults to every namespace because `fallbackNS` resolves across all three
 * at runtime; pass one to tighten a surface that only reads from it.
 * Components take this rather than `TFunction` so a key deleted from the
 * locale JSON fails the build at the call site.
 */
export type Translate<Namespace extends I18nNamespace = I18nNamespace> = (
    key: TranslationKey<Namespace>,
    options?: Record<string, unknown>
) => string;

/**
 * Fails the build if the `CustomTypeOptions` augmentation stops reaching this
 * program, which degrades every key above to `string` with no diagnostic.
 *
 * Constrained alias, `false` not `never`, and a `.ts` module are each load
 * bearing: an unconstrained alias never errors, `never` satisfies
 * `extends true`, and `skipLibCheck` drops all `.d.ts` diagnostics.
 */
type Assert<T extends true> = T;
export type I18nKeysAreChecked = Assert<
    string extends TranslationKey ? false : true
>;
