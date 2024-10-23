"use client";

import { sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@module/atoms/store";
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
    useEffect(() => {
        const token = jotaiStore.get(sessionAtom)?.token;

        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !token) {
            console.log("Redirecting to registration");
            router.replace("/register");
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && token) {
            console.log("Redirecting to wallet");
            router.replace("/wallet");
        }
    }, [router, requireAuthenticated]);

    return children;
}
