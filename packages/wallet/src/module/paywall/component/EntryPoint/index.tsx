"use client";

import { Grid } from "@/module/common/component/Grid";
import { Skeleton } from "@/module/common/component/Skeleton";
import { usePaywall } from "@/module/paywall/provider";
import {
    decompressDataAndCheckHash,
    redirectRequestKeyProvider,
} from "@frak-wallet/sdk/core";
import type { StartArticleUnlockParams } from "@frak-wallet/sdk/core";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function PaywallEntryPoint() {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const { get } = useSearchParams();
    const { handleNewUnlockRequest } = usePaywall();

    useQuery({
        queryKey: ["getEncodedUnlockData"],
        queryFn: async () => {
            const params = get("params");
            const hash = get("hash");
            if (!(params && hash)) {
                throw new Error("Invalid unlock request");
            }

            // Parse the data
            const parsedUnlockData =
                await decompressDataAndCheckHash<StartArticleUnlockParams>(
                    {
                        compressed: decodeURIComponent(params),
                        compressedHash: decodeURIComponent(hash),
                    },
                    (data: StartArticleUnlockParams) =>
                        redirectRequestKeyProvider({
                            method: "frak_startArticleUnlock",
                            params: data,
                        })
                );
            // Handle the new unlock request
            await handleNewUnlockRequest(parsedUnlockData);

            // Smoothly navigate to /
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
