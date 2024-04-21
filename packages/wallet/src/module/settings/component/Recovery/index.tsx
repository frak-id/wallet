"use client";

import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";

/**
 * Component for the settings with the recovery link
 * @constructor
 */
export function RecoveryLink() {
    return (
        <Panel size={"small"}>
            <Title icon={<Shield size={32} />}>Recovery setup</Title>
            <CurrentRecoveryOption />
            <Link href={"/settings/recovery"}>Setup new recovery</Link>
        </Panel>
    );
}

/**
 * Component for the settings with the recovery options
 * @constructor
 */
function CurrentRecoveryOption() {
    const { address } = useAccount();
    const chainId = useChainId();

    const { data: currentOptions } = useQuery({
        queryKey: ["recovery", address, chainId],
        queryFn: async () => {
            if (!address) return null;
            // Fetch the recovery options
            return getCurrentRecoveryOption({ wallet: address, chainId });
        },
        enabled: !!address,
    });

    if (!currentOptions) {
        return null;
    }

    return (
        <p>
            Current guardian:{" "}
            <WalletAddress wallet={currentOptions.burnerAddress} />
        </p>
    );
}
