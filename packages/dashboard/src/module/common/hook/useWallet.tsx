import type {
    DashboardActionParams,
    DashboardActionReturnType,
    SendTransactionReturnType,
} from "@frak-labs/nexus-sdk/core";
import type { SendTransactionActionParamsType } from "@frak-labs/nexus-sdk/core";
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

    const { mutate: launchAction, isPending } = useDashboardAction({
        action,
        params,
        callback: setData,
    });

    const {
        mutate: sendTxAction,
        error,
        status,
    } = useSendTransactionAction({
        callback: setSendTxData,
    });
    useEffect(() => {
        console.log("sendTxAction", { error, status });
    }, [error, status]);

    const sendTx = useCallback(
        (params: SendTransactionActionParamsType) => sendTxAction(params),
        [sendTxAction]
    );

    return { data, launch: launchAction, isPending, sendTx, sendTxData };
}
