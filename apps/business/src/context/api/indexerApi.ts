import ky from "ky";

/**
 * API for the indexer
 */
export const indexerApi = ky.create({ prefixUrl: process.env.INDEXER_URL });
