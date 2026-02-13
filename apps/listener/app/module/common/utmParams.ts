/**
 * UTM parameter extraction utilities
 * Extracts marketing attribution parameters from URLs
 */

/**
 * UTM parameters for marketing attribution
 */
export type UtmParams = {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
};

/**
 * Extract UTM parameters from a URL
 * @param url - The URL to extract UTM parameters from
 * @returns Extracted UTM parameters, or undefined if none found
 */
export function extractUtmParams(url?: string): UtmParams | undefined {
    if (!url) return undefined;

    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;

        const utmSource = params.get("utm_source");
        const utmMedium = params.get("utm_medium");
        const utmCampaign = params.get("utm_campaign");
        const utmTerm = params.get("utm_term");
        const utmContent = params.get("utm_content");

        // Only return if at least one UTM param exists
        if (
            !utmSource &&
            !utmMedium &&
            !utmCampaign &&
            !utmTerm &&
            !utmContent
        ) {
            return undefined;
        }

        return {
            source: utmSource ?? undefined,
            medium: utmMedium ?? undefined,
            campaign: utmCampaign ?? undefined,
            term: utmTerm ?? undefined,
            content: utmContent ?? undefined,
        };
    } catch {
        return undefined;
    }
}
