import { KernelWallet } from "@frak-labs/app-essentials";
import type { Address, Chain, Client, Hex, Transport } from "viem";
import {
    type BaseFrakSmartAccount,
    baseFrakWallet,
} from "@/module/wallet/smartWallet/baseFrakWallet";

/**
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
 * @param client
 * @param authenticatorId
 * @param signatureProvider
 */
export async function frakEcdsaWalletSmartAccount<
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        ecdsaAddress,
        signatureProvider,
        preDeterminedAccountAddress,
    }: {
        ecdsaAddress: Address;
        signatureProvider: (args: { hash: Hex }) => Promise<Hex>;
        preDeterminedAccountAddress?: Address;
    }
): Promise<BaseFrakSmartAccount> {
    return baseFrakWallet(client, {
        getSignature: signatureProvider,
        stubSignature:
            "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
        generateInitCode: () =>
            KernelWallet.getFallbackWalletInitCode({
                ecdsaAddress,
            }),
        preDeterminedAccountAddress,
    });
}
