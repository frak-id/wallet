import { encodeAbiParameters, encodeFunctionData, type Hex } from "viem";
import { addresses, KernelInitAbi, kernelAddresses } from "../blockchain";

/**
 * The account creation ABI for a kernel smart account (from the KernelFactory)
 */
const createAccountAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_implementation",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "_data",
                type: "bytes",
            },
            {
                internalType: "uint256",
                name: "_index",
                type: "uint256",
            },
        ],
        name: "createAccount",
        outputs: [
            {
                internalType: "address",
                name: "proxy",
                type: "address",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
] as const;

/**
 * Represent the layout of the calldata used for a webauthn signature
 */
const webAuthNValidatorEnablingLayout = [
    { name: "authenticatorIdHash", type: "bytes32" },
    { name: "x", type: "uint256" },
    { name: "y", type: "uint256" },
] as const;

/**
 * Get the account initialization code for a kernel smart account
 * @param authenticatorId
 * @param signerPubKey
 */
function getWebAuthNSmartWalletInitCode({
    authenticatorIdHash,
    signerPubKey,
}: {
    authenticatorIdHash: Hex;
    signerPubKey: { x: Hex; y: Hex };
}): Hex {
    if (!signerPubKey) throw new Error("Owner account not found");

    const encodedPublicKey = encodeAbiParameters(
        webAuthNValidatorEnablingLayout,
        [authenticatorIdHash, BigInt(signerPubKey.x), BigInt(signerPubKey.y)]
    );

    // Build the account initialization data
    const initialisationData = encodeFunctionData({
        abi: KernelInitAbi,
        functionName: "initialize",
        args: [addresses.webAuthNValidator, encodedPublicKey],
    });

    // Build the account init code
    return encodeFunctionData({
        abi: createAccountAbi,
        functionName: "createAccount",
        args: [kernelAddresses.accountLogic, initialisationData, 0n],
    }) as Hex;
}

/**
 * Get the account initialization code for a fallback smart account (using a regular ecdsa key)
 * @param ecdsaAddress
 */
function getFallbackWalletInitCode({
    ecdsaAddress,
}: {
    ecdsaAddress: Hex;
}): Hex {
    if (!ecdsaAddress) throw new Error("Owner account not found");

    // Build the account initialization data
    const initialisationData = encodeFunctionData({
        abi: KernelInitAbi,
        functionName: "initialize",
        args: [kernelAddresses.ecdsaValidator, ecdsaAddress],
    });

    // Build the account init code
    return encodeFunctionData({
        abi: createAccountAbi,
        functionName: "createAccount",
        args: [kernelAddresses.accountLogic, initialisationData, 0n],
    }) as Hex;
}

export const KernelWallet = {
    getWebAuthNSmartWalletInitCode,
    getFallbackWalletInitCode,
};
