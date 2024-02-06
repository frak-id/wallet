/**
 * Format a hash address
 * @param hash
 */
export function formatHash(hash?: string) {
    const START_HASH_LENGTH = 8;
    const END_HASH_LENGTH = 4;
    const hashStart = hash?.slice(0, START_HASH_LENGTH);
    const hashEnd = hash?.slice(-END_HASH_LENGTH);
    const shortenHash = `${hashStart}...${hashEnd}`;
    return hash ? shortenHash : undefined;
}
