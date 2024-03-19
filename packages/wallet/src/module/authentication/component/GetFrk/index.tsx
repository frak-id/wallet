"use client";

import { userErc20TokensRevalidate } from "@/context/tokens/action/getTokenAsset";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { Landmark } from "lucide-react";

/**
 * Get some FRK
 */
export function GetFrk() {
    const { wallet } = useWallet();
    const { isAirdroppingFrk, airdropFrk } = useAirdropFrk();

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={async () => {
                    await airdropFrk({ wallet: wallet.address });
                    // Invalidate the user tokens
                    await userErc20TokensRevalidate();
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
