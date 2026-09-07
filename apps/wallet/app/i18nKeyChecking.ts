import type {
    DefaultTranslationKey,
    TranslationKey,
} from "@frak-labs/wallet-shared/types";

/**
 * Fails the build if this app's `tsconfig.json` `include` stops pulling in the
 * i18next `CustomTypeOptions` augmentation, which silently degrades
 * `ParseKeys` to `string` and unchecks every `t()` key.
 *
 * Assert-with-constraint, `false` not `never`, and a `.ts` module are each
 * required: an unconstrained alias never errors, `never` satisfies
 * `extends true`, and `skipLibCheck` drops all `.d.ts` diagnostics.
 */
type Assert<T extends true> = T;
export type I18nKeysAreChecked = Assert<
    string extends TranslationKey ? false : true
>;

/** Fails the build if `defaultNS` names a namespace absent from `Resources`. */
export type I18nDefaultKeysAreChecked = Assert<
    string extends DefaultTranslationKey ? false : true
>;
