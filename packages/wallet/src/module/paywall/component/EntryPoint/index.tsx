"use client";

import { Grid } from "@/module/common/component/Grid";
import { Skeleton } from "@/module/common/component/Skeleton";
import { setPaywallDataAtom } from "@/module/paywall/atoms/paywall";
import {
    decompressDataAndCheckHash,
    redirectRequestKeyProvider,
} from "@frak-labs/nexus-sdk/core";
import type {
    ExtractedParametersFromRpc,
    RedirectRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";

export function PaywallEntryPoint() {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const { get } = useSearchParams();

    const setPaywallContext = useSetAtom(setPaywallDataAtom);

    useEffect(() => {
        const params = get("params");
        const hash = get("hash");

        parseContext({ params, hash });
    }, [get]);

    /**
     * Parse the unlock data provided
     */
    const { mutate: parseContext } = useMutation({
        mutationKey: ["parseUnlockData"],
        mutationFn: async ({
            params,
            hash,
        }: { params?: string | null; hash?: string | null }) => {
            // Ensure we got data
            if (!(params && hash)) {
                console.error("Invalid unlock request");
                throw new Error("Invalid unlock request");
            }

            // Parse the data
            const parsedUnlockData = await decompressDataAndCheckHash<
                ExtractedParametersFromRpc<RedirectRpcSchema>
            >(
                {
                    compressed: decodeURIComponent(params),
                    compressedHash: decodeURIComponent(hash),
                },
                redirectRequestKeyProvider
            );
            // Handle the new unlock request
            await setPaywallContext(parsedUnlockData.params);

            // Smoothly navigate to the unlock page
            startTransition(() => {
                router.replace("/unlock");
            });

            // Return the parsed unlock data
            return parsedUnlockData;
        },
    });

    return (
        <Grid>
            <Skeleton height={400} />
        </Grid>
    );
}
