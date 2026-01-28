import { generateSsoUrl } from "@frak-labs/core-sdk";
import { useMemo } from "react";
import type { Hex } from "viem";
import type { AppSpecificSsoMetadata } from "../../stores/types";

/**
 * Hook used to get the sso link
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
    const link = useMemo(() => {
        return generateSsoUrl(
            window.location.origin,
            { directExit, redirectUrl, metadata, lang },
            merchantId,
            metadata.name
        );
    }, [merchantId, metadata, directExit, redirectUrl, lang]);

    return {
        link,
    };
}
