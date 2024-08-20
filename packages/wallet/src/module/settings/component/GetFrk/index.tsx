"use client";
import { isRunningInProd } from "@/context/common/env";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { Landmark } from "lucide-react";
import { useAccount } from "wagmi";

/**
 * Get some FRK
 */
export function GetFrk() {
    const { address } = useAccount();
    const { isAirdroppingFrk, airdropFrk } = useAirdropFrk();

    // If on prod, don't expose the airdrop option
    if (isRunningInProd) {
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
