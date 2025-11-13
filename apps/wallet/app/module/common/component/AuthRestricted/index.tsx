import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import {
    getSafeSession,
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { type PropsWithChildren, useEffect, useState } from "react";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";

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
    const sessionFromAtom = sessionStore(selectSession);
    const [canDisplay, setCanDisplay] = useState(false);
    const { pairingInfo } = usePendingPairingInfo();

    useEffect(() => {
        // Get the session from the atom, or a safe one
        //  this ensure that we are performing a sync read on mount
        const session = sessionFromAtom ?? getSafeSession();

        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !session?.token) {
            console.log("Redirecting to registration");
            navigate({ to: "/register", replace: true });
            return;
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && session?.token) {
            console.log("Redirecting to wallet");
            navigate({
                to: pairingInfo ? "/pairing" : "/wallet",
                replace: true,
            });
            return;
        }

        setCanDisplay(true);
    }, [requireAuthenticated, sessionFromAtom, navigate, pairingInfo]);

    if (canDisplay) {
        return children;
    }

    return <Skeleton />;
}
