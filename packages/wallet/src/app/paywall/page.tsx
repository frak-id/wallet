"use client";

import { parseUnlockRequest } from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function PaywallPage() {
    const { get } = useSearchParams();

    const { data: unlockData, isPending: isParsing } = useQuery({
        queryKey: ["getEncodedUnlockData"],
        queryFn: async () => {
            const rawCompressedParams = get("compressedParams");
            if (!rawCompressedParams) {
                throw new Error("Missing query params");
            }

            // Parse the data and return them
            console.log("rawCompressedParams", { rawCompressedParams });
            return await parseUnlockRequest(rawCompressedParams);
        },
    });

    useEffect(() => {
        console.log("Unlock data", unlockData);
    }, [unlockData]);

    return (
        <div>
            <h1>Paywall</h1>
            <p>Unlock the content by paying</p>
            <p>Is parsing unlock data? {isParsing}</p>
            <p>
                Unlocking article {unlockData?.articleId} on content{" "}
                {unlockData?.contentId}
            </p>
            <p>
                Unlocking price {unlockData?.price?.frkAmount} for{" "}
                {unlockData?.price?.unlockDurationInSec} seconds
            </p>
            <button type="button">Pay</button>
        </div>
    );
}
