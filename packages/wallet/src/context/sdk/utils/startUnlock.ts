import { hashAndCompressData } from "@frak-labs/nexus-sdk/core";
import type { StartArticleUnlockReturnType } from "@frak-labs/nexus-sdk/core";

/**
 * Function used to build the redirect url from a start unlock query
 */
export async function getStartUnlockResponseRedirectUrl({
    redirectUrl,
    response,
}: { redirectUrl: string; response: StartArticleUnlockReturnType }) {
    // Compress the data
    const { compressed, compressedHash } = await hashAndCompressData(response);

    // Parse the redirect URL provided
    const parsedRedirectUrl = new URL(redirectUrl);
    // Add the params to the URL
    parsedRedirectUrl.searchParams.set(
        "result",
        encodeURIComponent(compressed)
    );
    parsedRedirectUrl.searchParams.set(
        "hash",
        encodeURIComponent(compressedHash)
    );
    // Then build the URL
    return parsedRedirectUrl.toString();
}
