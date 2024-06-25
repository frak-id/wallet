import type {
    DashboardActionParams,
    DashboardActionReturnType,
    SendTransactionReturnType,
} from "@frak-labs/nexus-sdk/core";
import type { SendTransactionActionParamsType } from "@frak-labs/nexus-sdk/dist/core";
import {
    useDashboardAction,
    useSendTransactionAction,
} from "@frak-labs/nexus-sdk/react";
import { useCallback, useEffect, useState } from "react";

export function useWallet({ action, params }: DashboardActionParams) {
    /**
     * The data returned from the wallet
     */
    const [data, setData] = useState<DashboardActionReturnType | null>(null);
    const [sendTxData, setSendTxData] =
        useState<SendTransactionReturnType | null>(null);

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
        params,
        callback: (data) => {
            setData(data);

            // Close modal
            toggleIframeVisibility(false);
        },
    });

    const {
        mutate: sendTxAction,
        error,
        status,
    } = useSendTransactionAction({
        callback: (data) => {
            setSendTxData(data);

            if (data.key !== "sending") {
                // Close modal
                toggleIframeVisibility(false);
            }
        },
    });
    useEffect(() => {
        console.log("sendTxAction", { error, status });
    }, [error, status]);

    const launch = useCallback(() => {
        // Open modal
        toggleIframeVisibility(true);

        launchAction();
    }, [launchAction, toggleIframeVisibility]);

    const sendTx = useCallback(
        (params: SendTransactionActionParamsType) => {
            // Open modal
            toggleIframeVisibility(true);

            sendTxAction(params);
        },
        [sendTxAction, toggleIframeVisibility]
    );

    return { data, launch, isPending, sendTx, sendTxData };
}
