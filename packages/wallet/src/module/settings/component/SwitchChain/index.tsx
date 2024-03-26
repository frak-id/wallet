"use client";

import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import styles from "@/module/settings/component/Settings/index.module.css";
import { Database } from "lucide-react";
import { useMemo } from "react";
import { useChainId, useChains, useConfig } from "wagmi";

/**
 * Switch theme between light and dark mode
 */
export function SwitchChain() {
    const chains = useChains();
    const chainId = useChainId();
    const wagmiConfig = useConfig();

    /**
     * The current user chain
     */
    const currentChain = useMemo(
        () => chains.find((chain) => chain.id === chainId),
        [chains, chainId]
    );

    /**
     * The available chains for switching
     */
    const availableChains = useMemo(
        () => chains.filter((chain) => chain.id !== chainId),
        [chains, chainId]
    );

    return (
        <Panel size={"normal"} variant={"primary"}>
            <Row>
                <Database size={32} /> Chain <b>{currentChain?.name}</b>
            </Row>
            <ul className={styles.settings__list}>
                {availableChains.map((chain) => (
                    <li key={chain.id}>
                        <button
                            key={chain.id}
                            onClick={() => {
                                wagmiConfig.setState((x) => ({
                                    ...x,
                                    chainId: chain.id,
                                }));
                            }}
                            type={"button"}
                        >
                            {chain.name}
                        </button>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
