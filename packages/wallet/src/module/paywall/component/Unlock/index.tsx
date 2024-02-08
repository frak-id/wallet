"use client";

import { type PaywallContext, usePaywall } from "@/module/paywall/provider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { prepareUnlockRequestResponse } from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatEther } from "viem";

export function PaywallUnlock({ context }: { context: PaywallContext }) {
    const { wallet, balance } = useWallet();
    const { discard } = usePaywall();

    const { data: redirectUrl } = useQuery({
        queryKey: ["buildRedirectUrl", context.articleId, context.contentId],
        queryFn: async () => {
            if (!context) {
                return undefined;
            }

            // Parse the data and return them
            return prepareUnlockRequestResponse(context.redirectUrl, {
                key: "success",
                status: "in-progress",
                user: "0x00",
                userOpHash: "0x00",
            });
        },
        enabled: !!context,
    });

    return (
        <div>
            <h1>Paywall Unlock</h1>
            <p>Content: {context.contentTitle}</p>
            <p>Article: {context.articleTitle}</p>
            <p>Price: {formatEther(BigInt(context.price.frkAmount))} FRK </p>
            <p>Balance: {balance}</p>
            <p>Wallet: {wallet?.address}</p>

            <br />
            <br />
            <Link href={redirectUrl ?? ""}>Redirect success</Link>

            <br />
            <br />
            <button type="button" onClick={discard}>
                Discard unlock request
            </button>
        </div>
    );
}
