"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import { Landmark } from "lucide-react";
import { arbitrumSepolia } from "viem/chains";
import { useAccount, useChainId } from "wagmi";

/**
 * Get some FRK
 */
export function GetFrk() {
    const { address } = useAccount();
    const { isAirdroppingFrk, airdropFrk } = useAirdropFrk();
    const chainId = useChainId();

    // If we are not on arbitrum sepolia, don't display FRK airdrop option
    if (chainId !== arbitrumSepolia.id) {
        return null;
    }

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={async () => {
                    if (!address) {
                        return;
                    }

                    await airdropFrk({
                        wallet: address,
                        waitForReceipt: true,
                    });
                }}
            >
                <Row>
                    <Landmark size={32} /> Get a few FRK{" "}
                    {isAirdroppingFrk ? (
                        <span className={"dotsLoading"}>...</span>
                    ) : (
                        ""
                    )}
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
