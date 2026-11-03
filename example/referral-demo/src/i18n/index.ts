import { useCallback } from "react";
import { useDemoStore } from "@/core/store";

export type Lang = "fr" | "en";

export const LANGS: readonly Lang[] = ["fr", "en"];

type Dictionary = Record<string, string>;

/** `en` must carry exactly the keys of `fr`, so a missing translation is a type error. */
export type Messages<T extends Dictionary> = {
    fr: T;
    en: { [K in keyof T]: string };
};

export type MessageVars = Record<string, string | number>;

export function defineMessages<const T extends Dictionary>(
    messages: Messages<T>
): Messages<T> {
    return messages;
}

/** Replaces every `{name}` placeholder with `vars.name`; unknown ones stay as-is. */
export function interpolate(template: string, vars?: MessageVars): string {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match
    );
}

export function useLang(): Lang {
    return useDemoStore((s) => s.lang);
}

/**
 * Binds a module's dictionary to the current language.
 *
 * @example
 * const t = useT(messages);
 * t("cta", { reward: "10 €" });
 */
export function useT<T extends Dictionary>(messages: Messages<T>) {
    const lang = useLang();
    return useCallback(
        (key: keyof T & string, vars?: MessageVars) =>
            interpolate(messages[lang][key] ?? String(key), vars),
        [lang, messages]
    );
}
