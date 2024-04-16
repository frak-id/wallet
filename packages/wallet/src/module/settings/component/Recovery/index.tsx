"use client";

import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useDownloadRecoveryFile } from "@/module/recovery/hook/useDownloadRecoveryFile";
import { useGenerateRecoveryOptions } from "@/module/recovery/hook/useGenerateRecoveryOptions";
import { useParseRecoveryFile } from "@/module/recovery/hook/useParseRecoveryFile";
import { useRecoverySetupStatus } from "@/module/recovery/hook/useRecoverySetupStatus";
import { useSetupRecovery } from "@/module/recovery/hook/useSetupRecovery";
import type { CurrentRecovery } from "@/types/Recovery";
import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Shield } from "lucide-react";
import { useAccount, useChainId } from "wagmi";

/**
 * Component for the settings with the recovery options
 * @constructor
 */
export function RecoveryOption() {
    const { address } = useAccount();
    const chainId = useChainId();

    const { data: currentOptions, isLoading } = useQuery({
        queryKey: ["recovery", address, chainId],
        queryFn: async () => {
            if (!address) return null;
            // Fetch the recovery options
            return getCurrentRecoveryOption({ wallet: address, chainId });
        },
        enabled: !!address,
    });

    return (
        <Panel size={"small"}>
            <Title icon={<Shield size={32} />}>Recovery setup</Title>
            <CurrentRecoveryOptions
                currentOptions={currentOptions}
                isLoading={isLoading}
            />
            <TestRecoveryFile />
            <TestRecoverySetup />
        </Panel>
    );
}

/**
 * Display the current recovery options
 * @param currentOptions
 * @param isLoading
 * @constructor
 */
function CurrentRecoveryOptions({
    currentOptions,
    isLoading,
}: { currentOptions?: CurrentRecovery | null; isLoading: boolean }) {
    if (isLoading) {
        return <p>Loading...</p>;
    }
    if (!currentOptions) {
        return <p>Not setup for the current chain</p>;
    }
    return <p>Guardian: {currentOptions.burnerAddress}</p>;
}

function TestRecoveryFile() {
    const { generateRecoveryOptionsAsyc } = useGenerateRecoveryOptions();
    const { parseRecoveryFileAsync } = useParseRecoveryFile();
    const { downloadRecoveryFileAsync } = useDownloadRecoveryFile();

    return (
        <Button
            onClick={async () => {
                const recoveryOptions = await generateRecoveryOptionsAsyc({
                    wallet: {
                        address: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                        publicKey: {
                            x: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                            y: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                        },
                        authenticatorId: "test",
                    },
                    pass: "test",
                });
                console.log("File content", recoveryOptions);

                const parsed = await parseRecoveryFileAsync({
                    file: recoveryOptions.file,
                    pass: "test",
                });
                console.log("Parsed", parsed);

                console.log("Trigger the download");
                await downloadRecoveryFileAsync({
                    file: recoveryOptions.file,
                });
            }}
        >
            Test encryption
        </Button>
    );
}

function TestRecoverySetup() {
    const session = useAtomValue(sessionAtom);

    const chainId = useChainId();
    const { recoverySetupStatus, isLoading } = useRecoverySetupStatus({
        chainId,
    });
    const { setupRecoveryAsync, isPending } = useSetupRecovery({ chainId });
    const { generateRecoveryOptionsAsyc } = useGenerateRecoveryOptions();

    if (isLoading) {
        return <p>Loading status...</p>;
    }

    if (isPending) {
        return <p>Setting up recovery...</p>;
    }

    return (
        <>
            <p>Current guardian: {recoverySetupStatus?.burnerAddress}</p>
            <p>Current executor: {recoverySetupStatus?.executor}</p>
            <Button
                onClick={async () => {
                    if (!session) {
                        return;
                    }
                    const recoveryOptions = await generateRecoveryOptionsAsyc({
                        wallet: session.wallet,
                        pass: "test",
                    });
                    console.log("Recovery options", recoveryOptions);

                    const txHash = await setupRecoveryAsync({
                        setupTxData: recoveryOptions.setupTxData,
                    });
                    console.log("Tx hash", txHash);
                }}
            >
                Setup new recovery
            </Button>
        </>
    );
}
