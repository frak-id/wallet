import { compressJsonToB64 } from "@frak-labs/core-sdk";
import type { Hex } from "viem";
import type { AppSpecificSsoMetadata } from "../atoms/sso";
import { ssoParamsToCompressed } from "./ssoDataCompression";

/**
 * Generate an sso link
 */
export function getOpenSsoLink({
    productId,
    metadata,
    directExit,
    redirectUrl,
    lang,
}: {
    productId: Hex;
    metadata: AppSpecificSsoMetadata;
    directExit?: boolean;
    redirectUrl?: string;
    consumeKey?: Hex;
    lang?: "en" | "fr";
}) {
    // Build the sso compressed param
    const compressedParam = ssoParamsToCompressed({
        productId,
        metadata,
        directExit,
        redirectUrl,
        lang,
    });

    // Otherwise, just compress the params and send them
    const compressedString = compressJsonToB64(compressedParam);

    // Build the url with the params
    const ssoUrl = new URL(window.location.origin);
    ssoUrl.pathname = "/sso";
    ssoUrl.searchParams.set("p", compressedString);

    // Return the link
    return ssoUrl.toString();
}
