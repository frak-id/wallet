export function cleanObjects<T extends object>(obj: T): T | undefined {
    if (typeof obj !== "object" || obj === null) {
        if (typeof obj === "string" && obj === "") {
            return undefined; // Remove empty strings
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
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
