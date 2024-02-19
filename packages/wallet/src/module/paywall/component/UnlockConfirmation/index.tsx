// import { usePaywall } from "@/module/paywall/provider";
import type { UiState } from "@/types/Unlock";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function UnlockConfirmation({
    already,
    success,
}: { already?: UiState["already"]; success: UiState["success"] }) {
    const current = already || success;
    const router = useRouter();
    // const { clear: clearPaywallContext } = usePaywall();
    const [, startTransition] = useTransition();

    function clearAndRedirect() {
        if (!current?.redirectUrl) return;
        console.log("clearAndRedirect", current.redirectUrl);
        // clearPaywallContext();
        startTransition(() => {
            router.push(current.redirectUrl);
        });
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
            <button
                type={"button"}
                className={"button"}
                onClick={clearAndRedirect}
            >
                Click to read the article
            </button>
            <br />
            You will be redirected in 5sec
        </>
    );
}
