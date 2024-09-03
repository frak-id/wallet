import { KernelExecuteAbi } from "@/context/wallet/abi/kernel-account-abis";
import { type Address, type Hex, encodeFunctionData } from "viem";

/**
 * Encode a multicall for a wallet
 * @param txs
 */
export function encodeWalletMulticall(
    txs: readonly {
        to: Address;
        data?: Hex;
        value?: bigint;
    }[]
): Hex {
    return encodeFunctionData({
        abi: KernelExecuteAbi,
        functionName: "executeBatch",
        args: [
            txs.map((tx) => ({
                to: tx.to,
                value: tx.value ?? 0n,
                data: tx.data ?? "0x",
            })),
        ],
    });
}
