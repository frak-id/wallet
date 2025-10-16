import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useAtomValue } from "jotai";
import { type PropsWithChildren, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { sessionAtom } from "@/common/atoms/session";
import { getSafeSession } from "@/common/utils/safeSession";
import { usePendingPairingInfo } from "@/pairing/hook/usePendingPairingInfo";

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
    const [canDisplay, setCanDisplay] = useState(false);
    const { pairingInfo } = usePendingPairingInfo();

    useEffect(() => {
        // Get the session from the atom, or a safe one
        //  this ensure that we are performing a sync read on mount
        const session = sessionFromAtom ?? getSafeSession();

        // If require an auth but no token, redirect to registration
        if (requireAuthenticated && !session?.token) {
            console.log("Redirecting to registration");
            navigate("/register", { replace: true });
            return;
        }

        // If don't require an auth but have token, redirect to wallet
        if (!requireAuthenticated && session?.token) {
            console.log("Redirecting to wallet");
            navigate(pairingInfo ? "/pairing" : "/wallet", { replace: true });
            return;
        }

        setCanDisplay(true);
    }, [requireAuthenticated, sessionFromAtom, navigate, pairingInfo]);

    if (canDisplay) {
        return children;
    }

    return <Skeleton />;
}
