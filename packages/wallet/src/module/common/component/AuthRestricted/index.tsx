"use client";

import { sessionAtom } from "@/module/common/atoms/session";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";

/**
 * Simple wrapper that limit the access to the subpage depending on the authentication status
 * @param children
 * @param requireAuthenticated
 * @constructor
 */
export function AuthRestricted({
    children,
    requireAuthenticated,
}: PropsWithChildren<{ requireAuthenticated: boolean }>) {
    const router = useRouter();
    const session = useAtomValue(sessionAtom);
    useEffect(() => {
        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !session?.token) {
            console.log("Redirecting to registration");
            router.replace("/register");
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && session?.token) {
            console.log("Redirecting to wallet");
            router.replace("/wallet");
        }
    }, [router, requireAuthenticated, session?.token]);

    return children;
}
