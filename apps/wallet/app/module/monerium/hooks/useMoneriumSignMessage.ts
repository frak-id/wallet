import { type Hex, parseErc6492Signature } from "viem";
import { useSignMessage } from "wagmi";

/**
 * viem wraps the signature in ERC-6492 while it still sees the account as undeployed.
 * Monerium only checks ERC-1271 on the deployed account, which validates the inner signature.
 */
export function useMoneriumSignMessage(): (message: string) => Promise<Hex> {
    const { mutateAsync: signMessageAsync } = useSignMessage();
    return async (message) =>
        parseErc6492Signature(await signMessageAsync({ message })).signature;
}
