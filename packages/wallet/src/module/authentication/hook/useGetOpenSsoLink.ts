import { authenticatedBackendApi } from "@/context/common/backendClient";
import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { ssoParamsToCompressed } from "@/module/authentication/utils/ssoDataCompression";
import { compressJson } from "@frak-labs/nexus-sdk/core";
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
        async ({
            productId,
            metadata,
            directExit,
            redirectUrl,
            consumeKey,
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

            // If we got a consumption key, we want sso tracking, thus we need to call the backend to obtain a trackable link
            if (consumeKey) {
                const { data } =
                    await authenticatedBackendApi.auth.wallet.sso.create.post({
                        productId,
                        consumeKey,
                        params: compressedParam,
                    });
                if (data) {
                    return {
                        url: data.link,
                        trackingId: data.trackingId,
                    };
                }
            }

            // Otherwise, just compress the params and send them
            const compressedString = await compressJson(compressedParam);

            // Build the url with the params
            const ssoUrl = new URL(window.location.origin);
            ssoUrl.pathname = "/sso";
            ssoUrl.searchParams.set("p", compressedString);

            // Return the link
            return { url: ssoUrl.toString() };
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
    consumeKey,
    lang,
}: {
    productId: Hex;
    metadata: AppSpecificSsoMetadata;
    directExit?: boolean;
    redirectUrl?: string;
    consumeKey?: Hex;
    lang?: "en" | "fr";
}) {
    const getLink = useGetOpenSsoLink();

    const { data, ...query } = useQuery({
        queryKey: ["sso", productId, metadata, directExit, redirectUrl, lang, consumeKey],
        queryFn: async () => {
            // Return the link
            return getLink({
                productId,
                metadata,
                directExit,
                redirectUrl,
                lang,
                consumeKey,
            });
        },
    });
    return {
        link: data?.url,
        trackingId: data?.trackingId,
        ...query,
    };
}
