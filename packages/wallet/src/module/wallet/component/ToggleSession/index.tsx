import {
    getSessionEnableData,
    getSessionStatus,
} from "@/context/interaction/action/interactionSession";
import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { Panel } from "@/module/common/component/Panel";
import { Switch } from "@/module/common/component/Switch";
import { Tooltip } from "@/module/common/component/Tooltip";
import { Loader } from "@frak-labs/shared/module/asset/icons/Loader";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import styles from "./index.module.css";

export function ToggleSession() {
    const { address } = useAccount();
    const { sendTransactionAsync, isPending } = useSendTransaction();

    const { data: sessionStatus, isPending: sessionStatusIsPending } = useQuery(
        {
            queryKey: ["interactionSession", "status", address],
            queryFn: async () => {
                if (!address) {
                    return null;
                }
                return getSessionStatus({ wallet: address });
            },
            enabled: !!address,
        }
    );

    const { data: sessionSetupTxs } = useQuery({
        queryKey: ["interactionSession", "setup", address],
        queryFn: async () => {
            // Get timestamp in a week
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 7);

            return getSessionEnableData({ sessionEnd });
        },
    });

    if (sessionStatusIsPending) {
        return null;
    }

    return (
        <>
            <Panel variant={"invisible"} size={"none"}>
                <SessionClosed isClosed={!sessionStatus} />
                <div className={styles.toggleSession}>
                    <Switch
                        checked={!!sessionStatus}
                        onCheckedChange={async (checked) => {
                            // Add session
                            if (checked && address && sessionSetupTxs) {
                                const txData = encodeWalletMulticall(
                                    sessionSetupTxs.map((tx) => ({
                                        to: address,
                                        data: tx,
                                    }))
                                );
                                await sendTransactionAsync({
                                    to: address,
                                    data: txData,
                                });
                            }

                            // Remove session
                            if (!checked) {
                                // TODO disable session
                            }
                        }}
                    />{" "}
                    {sessionStatus
                        ? "Your session is open. You can be rewarded"
                        : "Open a session to get reward"}{" "}
                    <SessionTooltip sessionStatus={sessionStatus} />
                    {isPending && <Loader className={styles.loader} />}
                </div>
            </Panel>
        </>
    );
}

function SessionClosed({ isClosed }: { isClosed: boolean }) {
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        setClosed(isClosed);
    }, [isClosed]);

    return (
        closed && (
            <div className={styles.sessionClosed}>
                <p>
                    <span className={styles.sessionClosed__warning}>
                        &#9888;
                    </span>{" "}
                    Your session is closed. You can’t be rewarded.
                </p>
                <button
                    type={"button"}
                    className={styles.sessionClosed__close}
                    onClick={() => setClosed(false)}
                >
                    <X size={10} />
                </button>
            </div>
        )
    );
}

function SessionTooltip({
    sessionStatus,
}: {
    sessionStatus: { sessionStart: Date; sessionEnd: Date } | null | undefined;
}) {
    return (
        <Tooltip
            content={
                sessionStatus ? (
                    <>
                        You got an active session since{" "}
                        {new Date(
                            sessionStatus?.sessionStart
                        )?.toLocaleDateString()}{" "}
                        and until{" "}
                        {new Date(
                            sessionStatus?.sessionEnd
                        )?.toLocaleDateString()}
                    </>
                ) : (
                    "The session creation will permit us to send interaction data on chain for your wallet"
                )
            }
        >
            <span className={styles.sessionClosed__iconInfo}>i</span>
        </Tooltip>
    );
}
