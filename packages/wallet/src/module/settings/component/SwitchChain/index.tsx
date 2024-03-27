"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "@/module/settings/component/Settings/index.module.css";
import { AccordionChain } from "@/module/settings/component/SwitchChain/AccordionChain";
import { Link } from "lucide-react";
import { useMemo } from "react";
import type { Chain } from "viem";
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

    return (
        <Panel size={"normal"} variant={"primary"}>
            <AccordionChain
                trigger={
                    <Title icon={<Link size={32} />}>
                        Chain <b>{currentChain?.name}</b>
                    </Title>
                }
            >
                <ChainSelectionList
                    chains={chains}
                    currentChain={currentChain}
                    onSelect={(chainId) => {
                        // Update the current wagmi chain
                        wagmiConfig.setState((x) => ({
                            ...x,
                            chainId,
                        }));
                    }}
                />
            </AccordionChain>
        </Panel>
    );
}

function ChainSelectionList({
    chains,
    currentChain,
    onSelect,
}: {
    chains: readonly Chain[];
    currentChain?: Chain;
    onSelect: (chainId: number) => void;
}) {
    return (
        <ul className={styles.settings__list}>
            {chains.map((chain) => (
                <li key={chain.id}>
                    <ButtonRipple
                        size={"small"}
                        onClick={() => onSelect(chain.id)}
                        disabled={chain.id === currentChain?.id}
                    >
                        {chain.name}
                    </ButtonRipple>
                </li>
            ))}
        </ul>
    );
}
