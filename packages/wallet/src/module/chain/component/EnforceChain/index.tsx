import {
    type AvailableChainIds,
    availableChains,
} from "@/context/blockchain/provider";
import { useSwitchConfigChain } from "@/module/chain/hook/useSwitchConfigChain";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { TriangleAlertIcon } from "lucide-react";
import { type PropsWithChildren, useMemo } from "react";
import { extractChain } from "viem";
import { useChainId } from "wagmi";
import styles from "./index.module.css";

type EnforceChainProps = {
    targetChainId: number;
    // If true, we are not going to switch the chain silently and display the children directly
    silentSwitch?: boolean;
    // Some more context to display to the user if needed
    wantedAction?: string;
};

/**
 * Component used to enforce a specific chainId
 * @param targetChainId
 * @param children
 * @param silentSwitch
 * @param wantedAction
 */
export function EnforceChain({
    targetChainId,
    children,
    silentSwitch = false,
    wantedAction,
}: PropsWithChildren<EnforceChainProps>) {
    const chainId = useChainId();
    const performChainSwitch = useSwitchConfigChain();

    // If we already are on the right chain, directly return the children
    if (chainId === targetChainId) {
        return children;
    }

    // If we are not on the right chain, and we are supposed to switch silently, switch the chain
    if (silentSwitch) {
        performChainSwitch(targetChainId);
        return children;
    }

    // Otherwise, modal prompting the user to switch the chain
    return (
        <EnforceChainExplanation
            currentChainId={chainId}
            targetChainId={targetChainId}
            performChainSwitch={() => performChainSwitch(targetChainId)}
            wantedAction={wantedAction}
        />
    );
}

/**
 * Explanation and action to perform the chain switch
 * @param wantedAction
 * @param currentChainId
 * @param targetChainId
 * @param performChainSwitch
 * @constructor
 */
function EnforceChainExplanation({
    wantedAction,
    currentChainId,
    targetChainId,
    performChainSwitch,
}: {
    wantedAction?: string;
    currentChainId: number;
    targetChainId: number;
    performChainSwitch: () => void;
}) {
    const currentChainName = useMemo(
        () =>
            extractChain({
                chains: availableChains,
                id: currentChainId as AvailableChainIds,
            }).name,
        [currentChainId]
    );
    const targetChainName = useMemo(
        () =>
            extractChain({
                chains: availableChains,
                id: targetChainId as AvailableChainIds,
            }).name,
        [targetChainId]
    );

    return (
        <>
            <Panel
                variant={"primary"}
                size={"normal"}
                className={styles.encoreChain__container}
            >
                <Title icon={<TriangleAlertIcon size={32} />}>
                    Change chain
                </Title>

                <p>
                    You need to change chain to{" "}
                    <b>{wantedAction ?? "perform this action"}</b>
                </p>

                <p>
                    Current chain: <b>{currentChainName}</b>
                </p>
                <p>
                    Required chain: <b>{targetChainName}</b>
                </p>

                <ButtonRipple onClick={performChainSwitch}>
                    Switch to {targetChainName}
                </ButtonRipple>
            </Panel>
        </>
    );
}
