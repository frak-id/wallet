import { usePaywall } from "@/module/paywall/provider";
import type { UiState } from "@/types/Unlock";
import { useEffect } from "react";

export function UnlockConfirmation({
    already,
    success,
}: { already?: UiState["already"]; success: UiState["success"] }) {
    const current = already || success;
    const { clear: clearPaywallContext } = usePaywall();

    function clearAndRedirect() {
        if (!current?.redirectUrl) return;
        clearPaywallContext({ redirectUrl: current.redirectUrl });
    }

    useEffect(() => {
        if (!current?.redirectUrl) return;

        // Do a redirect in 5sec
        const timeout = setTimeout(clearAndRedirect, 5000);
        return () => {
            clearTimeout(timeout);
        };
    }, [current?.redirectUrl]);

    if (!current) {
        return null;
    }

    return (
        <>
            {already && "You have already purchased this article"}
            {success && "The transaction was sent with success!"}
            <br />
            Click to read the article
            <br />
            You will be redirected in 5sec
        </>
    );
}
