"use client";

import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useGenerateRecoveryFile } from "@/module/recovery/hook/useGenerateRecoveryFile";
import { useParseRecoveryFile } from "@/module/recovery/hook/useParseRecoveryFile";
import type { CurrentRecovery, GeneratedRecoveryData } from "@/types/Recovery";
import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { useMemo } from "react";
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
    const testEncryption = useGenerateRecoveryFile();
    const testDecryption = useParseRecoveryFile();

    const baseOption: GeneratedRecoveryData = useMemo(
        () => ({
            wallet: {
                address: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                publicKey: {
                    x: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                    y: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                },
                authenticatorId: "test",
            },
            burner: {
                privateKey: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
                address: "0x2951C0Dac251C4c015467ede5A9Cb31cEB4d3694",
            },
            setupTxData: "0x123",
        }),
        []
    );

    return (
        <Button
            onClick={async () => {
                const fileContent = await testEncryption({
                    option: baseOption,
                    pass: "test",
                });
                console.log("File content", fileContent);

                const parsed = await testDecryption({
                    file: fileContent,
                    pass: "test",
                });
                console.log("Parsed", parsed);
            }}
        >
            Test encryption
        </Button>
    );
}
