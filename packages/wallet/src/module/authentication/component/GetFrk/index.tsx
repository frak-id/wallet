"use client";

import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { Landmark } from "lucide-react";
import styles from "./index.module.css";

/**
 * Get some FRK
 */
export function GetFrk() {
    const { wallet } = useWallet();
    const { isAirdroppingFrk, airdropFrk } = useAirdropFrk();

    return (
        <Panel withShadow={true} size={"small"}>
            <button
                type={"button"}
                className={styles.getFrk}
                onClick={async () => {
                    await airdropFrk({ wallet: wallet.address });
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
            </button>
        </Panel>
    );
}
