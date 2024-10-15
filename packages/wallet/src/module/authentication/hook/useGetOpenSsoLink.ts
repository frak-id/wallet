import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { ssoParamsToCompressed } from "@/module/authentication/utils/ssoDataCompression";
import { compressJson } from "@frak-labs/nexus-sdk/core";
import { backendApi } from "@frak-labs/shared/context/server";
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
            consumeKey?: string;
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
                const { data } = await backendApi.auth.wallet.sso.create.post({
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

export function useOpenSso() {
    return useCallback((link: string) => {
        // If we are on the server side do nothing
        if (window === undefined) return;

        // Promise to wait for the popup to open
        return new Promise<boolean>((resolve) => {
            try {
                // Open the popup (in the main thread via setTimeout)
                setTimeout(() => {
                    const openedWindow = window.open(
                        link,
                        "frak-sso",
                        "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
                    );
                    if (openedWindow) {
                        openedWindow.focus();
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 50);
            } catch (e) {
                console.error("Open SSO error", e);
                resolve(false);
            }
        });
    }, []);
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
        queryKey: ["sso", productId, metadata, directExit, redirectUrl, lang],
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
    });
    return {
        link: data,
        ...query,
    };
}
