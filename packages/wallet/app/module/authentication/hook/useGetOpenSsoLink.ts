import { authenticatedBackendApi } from "@/context/common/backendClient";
import {
    type AppSpecificSsoMetadata,
    ssoConsumeKey,
} from "@/module/authentication/atoms/sso";
import { ssoParamsToCompressed } from "@/module/authentication/utils/ssoDataCompression";
import {
    getFromLocalStorage,
    getSafeSession,
} from "@/module/listener/utils/localStorage";
import { compressJson } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

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
    useConsumeKey,
    lang,
}: {
    productId: Hex;
    metadata: AppSpecificSsoMetadata;
    directExit?: boolean;
    redirectUrl?: string;
    useConsumeKey?: boolean;
    lang?: "en" | "fr";
}) {
    const getLink = useGetOpenSsoLink();

    // Get the current consuming key if needed
    const safeConsumeKey = useMemo(() => {
        if (!useConsumeKey) return undefined;

        const consumeKey =
            jotaiStore.get(ssoConsumeKey) ??
            getFromLocalStorage<{
                key: Hex;
                generatedAt: number;
            }>("frak_ssoConsumeKey");

        // If we don't have a current consume key, generate a new one
        if (!consumeKey) {
            console.log("Generating new consume key cause of null", {
                consumeKey,
                testDirect: jotaiStore.get(ssoConsumeKey),
            });
            const key = generatePrivateKey();
            jotaiStore.set(ssoConsumeKey, { key, generatedAt: Date.now() });
            return key;
        }
        getSafeSession();

        // If we don't have a current consume key, generate a new one
        if (Date.now() - consumeKey.generatedAt > 3600000) {
            console.log("Generating new consume key cause of exp");
            const key = generatePrivateKey();
            jotaiStore.set(ssoConsumeKey, { key, generatedAt: Date.now() });
            return key;
        }

        return consumeKey.key;
    }, [useConsumeKey]);

    const { data, ...query } = useQuery({
        queryKey: [
            "sso",
            "link",
            productId,
            metadata,
            directExit,
            redirectUrl,
            lang,
            safeConsumeKey,
        ],
        queryFn: async () => {
            // Return the link
            return getLink({
                productId,
                metadata,
                directExit,
                redirectUrl,
                lang,
                consumeKey: safeConsumeKey,
            });
        },
        // Try to refetch the link the least possible (to keep the sso openned)
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
    return {
        link: data?.url,
        trackingId: data?.trackingId,
        ...query,
    };
}
