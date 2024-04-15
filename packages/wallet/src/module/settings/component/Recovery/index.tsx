"use client";

import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { CurrentRecovery } from "@/types/Recovery";
import { useQuery } from "@tanstack/react-query";
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
