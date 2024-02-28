import {
    getRedirectResponseResponseKeyProvider,
    hashAndCompressData,
} from "@frak-wallet/sdk/core";
import type { StartArticleUnlockReturnType } from "@frak-wallet/sdk/core";

/**
 * Function used to build the redirect url from a start unlock query
 */
export async function getStartUnlockResponseRedirectUrl({
    redirectUrl,
    response,
}: { redirectUrl: string; response: StartArticleUnlockReturnType }) {
    // Get the key provider we will use to compress the response
    const keyProvider = getRedirectResponseResponseKeyProvider(
        "frak_startArticleUnlock"
    );

    // Compress the data
    const { compressed, compressedHash } = await hashAndCompressData(
        response,
        keyProvider
    );

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
