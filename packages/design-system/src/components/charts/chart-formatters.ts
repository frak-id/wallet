const dateFmtCache = new Map<string, Intl.DateTimeFormat>();

function cachedDateFmt(
    kind: string,
    locale: string,
    options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = `${kind}:${locale}`;
    let fmt = dateFmtCache.get(key);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat(locale, options);
        dateFmtCache.set(key, fmt);
    }
    return fmt;
}

/** `Jan 1` — short month + day. Locale-aware, cached per locale. */
export function getShortDateFmt(locale: string): Intl.DateTimeFormat {
    return cachedDateFmt("short", locale, { month: "short", day: "numeric" });
}

/** `Mon, Jan 1` — weekday + short month + day. Locale-aware, cached per locale. */
export function getWeekdayDateFmt(locale: string): Intl.DateTimeFormat {
    return cachedDateFmt("weekday", locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

const numberFmtCache = new Map<string, Intl.NumberFormat>();

/** Integer formatter (grouping separators). Locale-aware, cached per locale. */
export function getIntFmt(locale: string): Intl.NumberFormat {
    let fmt = numberFmtCache.get(locale);
    if (!fmt) {
        fmt = new Intl.NumberFormat(locale);
        numberFmtCache.set(locale, fmt);
    }
    return fmt;
}
