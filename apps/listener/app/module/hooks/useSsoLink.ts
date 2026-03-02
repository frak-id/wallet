import { generateSsoUrl } from "@frak-labs/core-sdk";
import { clientIdStore } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import type { Hex } from "viem";

/**
 * App-specific SSO metadata extending the base SsoMetadata
 */
export type AppSpecificSsoMetadata = {
    name: string;
    css?: string;
    logoUrl?: string;
    homepageLink?: string;
};

/**
 * Hook used to generate an SSO link for authentication
 *
 * @param merchantId - The merchant's blockchain address
 * @param metadata - App-specific metadata (name, css, logo, etc.)
 * @param directExit - If true, closes the SSO window immediately after auth
 * @param redirectUrl - URL to redirect to after SSO completion
 * @param lang - Language preference ("en" or "fr")
 * @returns Object containing the generated SSO link
 */
export function useSsoLink({
    merchantId,
    metadata,
    directExit,
    redirectUrl,
    lang,
}: {
    merchantId: Hex;
    metadata: AppSpecificSsoMetadata;
    directExit?: boolean;
    redirectUrl?: string;
    lang?: "en" | "fr";
}) {
    const clientId = clientIdStore((state) => state.clientId);
    const link = useMemo(
        () =>
            generateSsoUrl(
                window.location.origin,
                { directExit, redirectUrl, metadata, lang },
                merchantId,
                metadata.name,
                clientId ?? "",
                metadata.css
            ),
        [merchantId, metadata, directExit, redirectUrl, lang, clientId]
    );

    return {
        link,
    };
}
