import { useSwitchConfigChain } from "@/module/chain/hook/useSwitchConfigChain";
import type { PropsWithChildren } from "react";
import { useChainId } from "wagmi";

type EnforceChainProps = {
    targetChainId: number;
    // If true, we are not going to switch the chain silently and display the children directly
    silentSwitch?: boolean;
};

/**
 * Component used to enforce a specific chainId
 * @param targetChainId
 * @param children
 * @param silentSwitch
 */
export function EnforceChain({
    targetChainId,
    children,
    silentSwitch = false,
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

    // TODO: Otherwise, modal prompting the user to switch the chain
    return (
        <>
            <b>You are not on the right chain</b>
            {children}
        </>
    );
}
