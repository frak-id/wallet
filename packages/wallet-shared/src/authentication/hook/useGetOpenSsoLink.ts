import { generateSsoUrl } from "@frak-labs/core-sdk";
import { useMemo } from "react";
import type { Hex } from "viem";
import { clientIdStore } from "@/stores/clientIdStore";
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
    const clientId = clientIdStore((state) => state.clientId);
    const link = useMemo(
        () =>
            generateSsoUrl(
                window.location.origin,
                { directExit, redirectUrl, metadata, lang },
                merchantId,
                metadata.name,
                metadata.css,
                clientId
            ),
        [merchantId, metadata, directExit, redirectUrl, lang, clientId]
    );

    return {
        link,
    };
}
