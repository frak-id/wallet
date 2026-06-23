import { enUS, fr, type Locale } from "date-fns/locale";

/** Map an i18next language code to the matching date-fns locale. */
export function getDateFnsLocale(language: string): Locale {
    return language.startsWith("fr") ? fr : enUS;
}
