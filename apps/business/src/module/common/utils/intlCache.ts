/**
 * Cached Intl formatters. Constructing an `Intl.*Format` parses locale data and
 * is comparatively expensive, so we memoise by locale + options and reuse the
 * instance across calls (e.g. once per table instead of once per rendered cell).
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function getNumberFormat(
    locale: string | undefined,
    options: Intl.NumberFormatOptions
): Intl.NumberFormat {
    const key = `${locale ?? ""}|${JSON.stringify(options)}`;
    let formatter = numberFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, options);
        numberFormatters.set(key, formatter);
    }
    return formatter;
}

export function getDateTimeFormat(
    locale: string | undefined,
    options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = `${locale ?? ""}|${JSON.stringify(options)}`;
    let formatter = dateTimeFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options);
        dateTimeFormatters.set(key, formatter);
    }
    return formatter;
}
