"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang={"en"}>
            <body>
                <h2>Something went wrong!</h2>
                <button type={"button"} onClick={() => reset()}>
                    Try again
                </button>
            </body>
        </html>
    );
}
