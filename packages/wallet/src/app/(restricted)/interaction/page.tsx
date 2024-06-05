"use client";
import { kernelAddresses } from "@/context/blockchain/addresses";
import {
    getSessionEnableData,
    getSessionStatus,
} from "@/context/interaction/action/interactionSession";
import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import { Button } from "@/module/common/component/Button";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAccount, useSendTransaction } from "wagmi";

export default function InteractionPage() {
    const { address } = useAccount();

    const { data: sessionStatus, error: sessionError } = useQuery({
        queryKey: ["interactionSession", "status", address],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            return getSessionStatus({ wallet: address });
        },
        enabled: !!address,
    });

    useEffect(() => {
        console.log("Session stuff", { sessionStatus, sessionError });
    }, [sessionStatus, sessionError]);

    const {
        sendTransactionAsync,
        data: setupSessionData,
        error: setupSessionError,
    } = useSendTransaction();
    const { data: sessionSetupTx, error: sessionSetupError } = useQuery({
        queryKey: ["interactionSession", "setup", address],
        queryFn: async () => {
            // Get timestamp in a week
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 7);

            return getSessionEnableData({ sessionEnd });
        },
    });
    useEffect(() => {
        console.log("Session setup stuff", {
            sessionSetupTx,
            sessionSetupError,
            setupSessionData,
            setupSessionError,
        });
    }, [
        sessionSetupTx,
        sessionSetupError,
        setupSessionData,
        setupSessionError,
    ]);

    return (
        <div>
            <h1>Interaction</h1>
            <p>Address: {address}</p>
            <br />
            <br />

            <h2>Session status</h2>
            {sessionStatus ? (
                <div>
                    <p>
                        Session start: {sessionStatus.sessionStart.toString()}
                    </p>
                    <p>Session end: {sessionStatus.sessionEnd.toString()}</p>
                </div>
            ) : (
                "No session"
            )}
            <br />
            <br />

            <h2>Session setup</h2>
            {sessionSetupTx ? (
                <div>
                    <p>Session setup tx: {sessionSetupTx}</p>
                </div>
            ) : (
                "No session setup"
            )}
            <Button
                onClick={() => {
                    if (!(address && sessionSetupTx)) {
                        return;
                    }
                    return sendTransactionAsync({
                        to: kernelAddresses.interactionSessionValidator,
                        data: sessionSetupTx,
                    });
                }}
            >
                Setup session
            </Button>
            <br />
            <br />

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
        </div>
    );
}

//
// 0x0c959556
// 0000000000000000000000000000000000000000000000000000000000000020
// 0000000000000000000000000000000000000000000000000000000000000060
// 000000000000000000000000000000000000000000000000000000006660f2fb
// 0000000000000000000000000000000000000000000000000000000000000000
// 00000000000000000000000035f3e191523c8701ad315551dcbdcc5708efd7ec
// 0x0c959556
// 0000000000000000000000000000000000000000000000000000000000000020
// 0000000000000000000000000000000000000000000000000000000000000060
// 0000000000000000000000000000000000000000000000000000000000000000
// 000000000000000000000000000000000000000000000000000000006660f3f8
// 00000000000000000000000035f3e191523c8701ad315551dcbdcc5708efd7ec
