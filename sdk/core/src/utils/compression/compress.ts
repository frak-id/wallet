/**
 * Compress json data
 * @param data
 * @ignore
 */
export function compressJson(data: unknown): string {
    return btoa(encodeURIComponent(JSON.stringify(data)));
}
