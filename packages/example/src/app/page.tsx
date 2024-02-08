"use client";

import { getMockedUnlockLink } from "@/context/article/action/unlock";
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
        queryFn: async () => getMockedUnlockLink(),
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
