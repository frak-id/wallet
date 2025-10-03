import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { useMemo } from "react";
import type { Hex } from "viem";
import { getOpenSsoLink } from "../utils/ssoLink";

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
        return getOpenSsoLink({
            productId,
            metadata,
            directExit,
            redirectUrl,
            lang,
        });
    }, [productId, metadata, directExit, redirectUrl, lang]);

    return {
        link,
    };
}
