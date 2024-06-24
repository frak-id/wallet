import type {
    DashboardActionParams,
    DashboardActionReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useDashboardAction } from "@frak-labs/nexus-sdk/react";
import { useCallback, useEffect, useState } from "react";

export function useWallet({ action }: DashboardActionParams) {
    /**
     * The data returned from the wallet
     */
    const [data, setData] = useState<DashboardActionReturnType | null>(null);

    /**
     * The Nexus iframe
     */
    const [iframeElement, setIframeElement] = useState<Element | null>(null);

    useEffect(
        () => setIframeElement(document.querySelector("#nexus-wallet")),
        []
    );

    /**
     * Toggle the visibility of the iframe
     */
    const toggleIframeVisibility = useCallback(
        (visible: boolean) => {
            iframeElement?.classList.toggle("visible", visible);
        },
        [iframeElement]
    );

    const { mutate: launchAction, isPending } = useDashboardAction({
        action,
        callback: ({ key }) => {
            setData({ key });

            // Close modal
            toggleIframeVisibility(false);
        },
    });

    const launch = useCallback(() => {
        // Open modal
        toggleIframeVisibility(true);

        launchAction();
    }, [launchAction, toggleIframeVisibility]);

    return { data, launch, isPending };
}
