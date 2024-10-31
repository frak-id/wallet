import { sessionAtom } from "@/module/common/atoms/session";
import { useNavigate } from "@remix-run/react";
import { useAtomValue } from "jotai";
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
    const navigate = useNavigate();
    const session = useAtomValue(sessionAtom);

    useEffect(() => {
        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !session?.token) {
            console.log("Redirecting to registration");
            navigate("/register", { replace: true, viewTransition: true });
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && session?.token) {
            console.log("Redirecting to wallet");
            navigate("/wallet", { replace: true, viewTransition: true });
        }
    }, [requireAuthenticated, session?.token, navigate]);

    return children;
}
