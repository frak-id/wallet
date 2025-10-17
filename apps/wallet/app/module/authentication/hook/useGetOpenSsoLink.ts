import { generateSsoUrl } from "@frak-labs/core-sdk";
import type { AppSpecificSsoMetadata } from "@frak-labs/wallet-shared/authentication/atoms/sso";
import { useMemo } from "react";
import type { Hex } from "viem";

/**
 * Hook used to get the sso link
 */
export function useSsoLink({
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
    lang?: "en" | "fr";
}) {
    const link = useMemo(() => {
        return generateSsoUrl(
            window.location.origin,
            { directExit, redirectUrl, metadata, lang },
            productId,
            metadata.name
        );
    }, [productId, metadata, directExit, redirectUrl, lang]);

    return {
        link,
    };
}
