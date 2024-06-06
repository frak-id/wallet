"use client";
import {
    getSessionEnableData,
    getSessionStatus,
} from "@/context/interaction/action/interactionSession";
import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import { Button } from "@/module/common/component/Button";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount, useSendTransaction } from "wagmi";

export default function InteractionPage() {
    const { address } = useAccount();

    const { data: sessionStatus } = useQuery({
        queryKey: ["interactionSession", "status", address],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            return getSessionStatus({ wallet: address });
        },
        enabled: !!address,
    });

    return (
        <div>
            <h1>Interaction</h1>
            <p>Address: {address}</p>
            <br />
            <br />

            <StatusWidget status={sessionStatus} />

            {!sessionStatus ? <CreateSession /> : <></>}

            <PushInteractionButton />
        </div>
    );
}

function StatusWidget({
    status,
}: { status?: { sessionStart: Date; sessionEnd: Date } | null }) {
    return (
        <>
            <h2>Session status</h2>
            {status ? (
                <div>
                    <p>Session start: {status.sessionStart.toString()}</p>
                    <p>Session end: {status.sessionEnd.toString()}</p>
                </div>
            ) : (
                "No session"
            )}
            <br />
            <br />
        </>
    );
}

function CreateSession() {
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    const { data: sessionSetupTxs } = useQuery({
        queryKey: ["interactionSession", "setup", address],
        queryFn: async () => {
            // Get timestamp in a week
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 7);

            return getSessionEnableData({ sessionEnd });
        },
    });

    return (
        <>
            <h2>Session setup</h2>
            {sessionSetupTxs ? (
                <div>
                    <p>Session setup tx: {sessionSetupTxs}</p>
                </div>
            ) : (
                "No session setup"
            )}
            <Button
                onClick={async () => {
                    if (!(address && sessionSetupTxs)) {
                        return;
                    }
                    // todo: Should be execute batch here mf
                    for (const sessionSetupTx of sessionSetupTxs) {
                        await sendTransactionAsync({
                            to: address,
                            data: sessionSetupTx as Hex,
                        });
                    }
                }}
            >
                Setup session
            </Button>
            <br />
            <br />
        </>
    );
}

function PushInteractionButton() {
    const { address } = useAccount();

    return (
        <>
            <h2>Interaction</h2>
            <Button
                onClick={async () => {
                    if (!address) {
                        return;
                    }
                    await pushInteraction({ wallet: address });
                }}
            >
                Push interaction
            </Button>
        </>
    );
}
