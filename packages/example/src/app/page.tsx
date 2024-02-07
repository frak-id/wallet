"use client";

import { getUnlockRequestUrl } from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function HomePage() {
    const router = useRouter();
    const [, startTransition] = useTransition();

    function goToArticles() {
        startTransition(() => {
            router.push("/articles");
        });
    }

    const { data: unlockUrl } = useQuery({
        queryKey: ["getEncodedUnlockData"],
        queryFn: async () =>
            await getUnlockRequestUrl(
                {
                    walletUrl: process.env.FRAK_WALLET_URL as string,
                },
                {
                    articleId: "0xdeadbeef",
                    contentId: "0xdeadbeef",
                    price: {
                        index: 0,
                        unlockDurationInSec: 0,
                        frkAmount: "0x0",
                    },
                    articleUrl: "https://path-to-the-article.com/",
                    redirectUrl:
                        "https://path-to-the-article.with-unlock-handling.com/",
                }
            ),
    });

    return (
        <div>
            <h1>Example interaction with Frak wallet</h1>
            <p>
                Welcome to the Frak Wallet example. This is a simple example
                showcasing the possible interaction with the Frak wallet.
            </p>
            <br />
            <button onClick={goToArticles} type="button">
                Checkout the articles
            </button>

            <br />
            <br />

            <Link href={`${process.env.FRAK_WALLET_URL}/paywall`}>
                Unlock with FRK
            </Link>

            <br />
            <br />

            {unlockUrl && (
                <Link href={unlockUrl}>Unlock with FRK (using the SDK)</Link>
            )}
        </div>
    );
}
