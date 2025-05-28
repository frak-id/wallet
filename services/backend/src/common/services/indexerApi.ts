import ky from "ky";

export const indexerApi = ky.create({ prefixUrl: process.env.INDEXER_URL });
