"use client";

import { usePaywall } from "@/module/paywall/provider";
import { parseUnlockRequestParams } from "@frak-wallet/sdk";
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
            const parsedUnlockData = await parseUnlockRequestParams({
                params,
                hash,
            });

            // Handle the new unlock request
            await handleNewUnlockRequest(parsedUnlockData);

            // Smoothly navigate to /
            startTransition(() => {
                router.replace("/");
            });

            // Return the parsed unlock data
            return parsedUnlockData;
        },
    });

    // TODO: Display a smooth loader here
    return (
        <div>
            <h1>Parsing unlock data...</h1>
        </div>
    );
}
