import { sessionAtom } from "@/module/common/atoms/session";
import { getSafeSession } from "@/module/listener/utils/localStorage";
import { Skeleton } from "@module/component/Skeleton";
import { useNavigate } from "@remix-run/react";
import { useAtomValue } from "jotai";
import { type PropsWithChildren, useMemo } from "react";

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
    const sessionFromAtom = useAtomValue(sessionAtom);

    const canDisplay = useMemo(() => {
        // Get the session from the atom, or a safe one
        //  this ensure that we are performing a sync read on mount
        const session = sessionFromAtom ?? getSafeSession();

        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !session?.token) {
            console.log("Redirecting to registration");
            navigate("/register", { replace: true, viewTransition: true });
            return false;
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && session?.token) {
            console.log("Redirecting to wallet");
            navigate("/wallet", { replace: true, viewTransition: true });
            return false;
        }

        return true;
    }, [requireAuthenticated, sessionFromAtom, navigate]);

    if (canDisplay) {
        return children;
    }

    return <Skeleton />;
}
