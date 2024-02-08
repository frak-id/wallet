"use client";

import {
    parseUnlockResponse,
    prepareUnlockRequestResponse,
} from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function PaywallPage() {
    const { get } = useSearchParams();

    const {
        data: unlockData,
        isPending: isParsing,
        error,
    } = useQuery({
        queryKey: ["getEncodedUnlockData"],
        queryFn: async () => {
            const params = get("params");
            const hash = get("hash");
            if (!(params && hash)) {
                throw new Error("Invalid unlock request");
            }

            // Parse the data and return them
            return await parseUnlockResponse({ params, hash });
        },
    });

    useEffect(() => {
        console.log("Unlock data", unlockData);
        console.log("Unlock error", error);
    }, [unlockData, error]);

    const { data: redirectUrl, isPending: isBuildingResponse } = useQuery({
        queryKey: [
            "buildRedirectUrl",
            unlockData?.articleId,
            unlockData?.contentId,
        ],
        queryFn: async () => {
            if (!unlockData) {
                return undefined;
            }
            const params = get("params");
            const hash = get("hash");
            if (!(params && hash)) {
                throw new Error("Invalid unlock request");
            }

            // Parse the data and return them
            return prepareUnlockRequestResponse(unlockData.redirectUrl, {
                key: "success",
                status: "in-progress",
                user: "0x00",
                userOpHash: "0x00",
            });
        },
        enabled: !!unlockData,
    });

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

            <br />
            <br />

            <p>Is building response? {isBuildingResponse}</p>
            <p>Would redirect to {redirectUrl}</p>
            {redirectUrl && <Link href={redirectUrl}>Redirect</Link>}
        </div>
    );
}
