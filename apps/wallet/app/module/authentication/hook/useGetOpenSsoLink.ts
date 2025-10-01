import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { ssoKey } from "@/module/authentication/queryKeys/sso";
import { ssoParamsToCompressed } from "@/module/authentication/utils/ssoDataCompression";
import { compressJsonToB64 } from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Hex } from "viem";

/**
 * Feature for the sso popup
 */
export const ssoPopupFeatures =
    "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
export const ssoPopupName = "frak-sso";

/**
 * Hook used to get the sso link
 */
export function useGetOpenSsoLink() {
    return useCallback(
        ({
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
        }) => {
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
        },
        []
    );
}

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
    const getLink = useGetOpenSsoLink();

    const { data, ...query } = useQuery({
        queryKey: ssoKey.link.full({
            productId,
            metadata,
            directExit,
            redirectUrl,
            lang,
        }),
        queryFn: async () => {
            // Return the link
            return getLink({
                productId,
                metadata,
                directExit,
                redirectUrl,
                lang,
            });
        },
        // Try to refetch the link the least possible (to keep the sso opened)
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });

    return {
        link: data,
        ...query,
    };
}
