import { UAParser } from "ua-parser-js";

function parseUserAgent() {
    if (typeof navigator === "undefined") {
        return undefined;
    }

    return new UAParser(navigator.userAgent);
}

const parsedUserAgent = parseUserAgent();

/**
 * Get some details around the user agent
 */
export const ua = {
    isMobile: parsedUserAgent?.getDevice().type === "mobile",
    detailed: parsedUserAgent,
};
