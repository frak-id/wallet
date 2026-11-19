/**
 * 5 min cache for every version check: the wallet refetches on focus anyway,
 * this keeps fast navigation off Apple's iTunes endpoint, our backend and the OTA CDN.
 */
export const VERSION_STALE_TIME_MS = 5 * 60 * 1000;
