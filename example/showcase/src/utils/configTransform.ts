type SDKMetadata = {
    name: string;
    lang?: string;
    currency?: string;
    logoUrl?: string;
    homepageLink?: string;
};

type SDKCustomizations = {
    css?: string;
    i18n: Record<string, Record<string, string>>;
};

type SDKConfig = {
    metadata: SDKMetadata;
    customizations: SDKCustomizations;
};

/**
 * Recursively removes empty strings, empty objects, and undefined values
 */
export function cleanObjects<T extends object>(obj: T): T | undefined {
    if (typeof obj !== "object" || obj === null) {
        if (typeof obj === "string" && obj === "") {
            return undefined;
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        const newArray = obj
            .map((item) => cleanObjects(item as object))
            .filter(
                (item): item is NonNullable<typeof item> => item !== undefined
            );

        return newArray.length > 0 ? (newArray as unknown as T) : undefined;
    }

    const newObj = {} as Record<string, unknown>;
    let isEmpty = true;

    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            const value = cleanObjects(obj[key] as object);

            if (value !== undefined) {
                newObj[key] = value;
                isEmpty = false;
            }
        }
    }

    if (isEmpty) {
        return undefined;
    }

    return newObj as T;
}

/**
 * Removes language if it's set to "auto" (default value)
 */
function removeLanguageIfAuto(metadata: SDKMetadata): Partial<SDKMetadata> {
    const { lang, ...rest } = metadata;
    return lang === "auto" ? rest : metadata;
}

/**
 * Removes currency if it's set to "eur" (default value)
 */
function removeCurrencyIfEur(
    metadata: Partial<SDKMetadata>
): Partial<SDKMetadata> {
    const { currency, ...rest } = metadata;
    return currency === "eur" ? rest : metadata;
}

/**
 * Removes default values from metadata (lang: "auto", currency: "eur")
 */
export function removeDefaultValues(
    metadata: SDKMetadata
): Partial<SDKMetadata> {
    return removeCurrencyIfEur(removeLanguageIfAuto(metadata));
}

/**
 * Returns a cleaned configuration with default values and empty objects removed
 */
export function getCleanedConfig(config: SDKConfig) {
    const cleanedMetadata = cleanObjects(removeDefaultValues(config.metadata));
    const cleanedCustomizations = cleanObjects(config.customizations);

    return {
        ...(cleanedMetadata && { metadata: cleanedMetadata }),
        ...(cleanedCustomizations && { customizations: cleanedCustomizations }),
    };
}
