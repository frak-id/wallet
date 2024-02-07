"use client";

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
        </div>
    );
}
