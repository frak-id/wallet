import {
    getAccountNonce,
    getSenderAddress,
    getUserOperationHash,
} from "permissionless";
import {
    SignTransactionNotSupportedBySmartAccount,
    SmartAccount,
} from "permissionless/accounts";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    hashMessage,
    maxUint256,
} from "viem";
import { toAccount } from "viem/accounts";
import { getBytecode, getChainId } from "viem/actions";
import {P256PubKey, WebAuthNSignature} from "@/types/WebAuthN";
import {KernelExecuteAbi, KernelInitAbi} from "@/context/wallet/abi/KernelAccountAbi";

export type KernelP256SmartAccount<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<"kernelWebAuthNSmartAccount", transport, chain>;

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
 * Default addresses for kernel smart account
 *   p256 wrapper address: 0xC06343F2BEC213A3c21a5B0404A70F30BD7d5216
 *   validator address: 0xB38806b3b3aE69271b2A57319E21998A41A1d82d
 */
const KERNEL_ADDRESSES: {
    P256_VALIDATOR: Address;
    WEB_AUTHN_VALIDATOR: Address;
    ACCOUNT_V3_LOGIC: Address;
    FACTORY: Address;
    ENDTRYPOINT_V0_6: Address;
} = {
    // Validators
    P256_VALIDATOR: "0xea91Fc104e3EE4A249ae7CE617fd988Ef020DD0c",
    WEB_AUTHN_VALIDATOR: "0xB38806b3b3aE69271b2A57319E21998A41A1d82d",
    // Kernel stuff
    ACCOUNT_V3_LOGIC: "0xD3F582F6B4814E989Ee8E96bc3175320B5A540ab",
    FACTORY: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
    // ERC-4337 stuff
    ENDTRYPOINT_V0_6: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

/**
 * Get the account initialization code for a kernel smart account
 * @param signerPubKey
 * @param index
 * @param factoryAddress
 * @param accountLogicAddress
 * @param webAuthNValidatorAddress
 */
const getAccountInitCode = async ({
    signerPubKey,
    index,
    factoryAddress,
    accountLogicAddress,
    webAuthNValidatorAddress,
}: {
    signerPubKey: P256PubKey;
    index: bigint;
    factoryAddress: Address;
    accountLogicAddress: Address;
    webAuthNValidatorAddress: Address;
}): Promise<Hex> => {
    if (!signerPubKey) throw new Error("Owner account not found");

    const encodedPublicKey = concatHex([signerPubKey.x, signerPubKey.y]);

    // Build the account initialization data
    const initialisationData = encodeFunctionData({
        abi: KernelInitAbi,
        functionName: "initialize",
        args: [webAuthNValidatorAddress, encodedPublicKey],
    });

    // Build the account init code
    return concatHex([
        factoryAddress,
        encodeFunctionData({
            abi: createAccountAbi,
            functionName: "createAccount",
            args: [accountLogicAddress, initialisationData, index],
        }) as Hex,
    ]);
};

/**
 * Check the validity of an existing account address, or fetch the pre-deterministic account address for a kernel smart wallet
 * @param client
 * @param signerPubKey
 * @param entryPoint
 * @param webAuthNValidatorAddress
 * @param initCodeProvider
 * @param deployedAccountAddress
 */
const getAccountAddress = async <
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
>({
    client,
    signerPubKey,
    entryPoint,
    initCodeProvider,
    webAuthNValidatorAddress,
    deployedAccountAddress,
}: {
    client: Client<TTransport, TChain>;
    signerPubKey: P256PubKey;
    initCodeProvider: () => Promise<Hex>;
    entryPoint: Address;
    webAuthNValidatorAddress: Address;
    deployedAccountAddress?: Address;
}): Promise<Address> => {
    // If we got an already deployed account, ensure it's well deployed, and the validator & signer are correct
    if (deployedAccountAddress !== undefined) {
        // TODO: Check the pub key match
        console.log(
            "TODO: Check the pub key match",
            signerPubKey,
            webAuthNValidatorAddress
        );
        // If ok, return the address
        return deployedAccountAddress;
    }

    // Find the init code for this account
    const initCode = await initCodeProvider();

    // Get the sender address based on the init code
    return getSenderAddress(client, {
        initCode,
        entryPoint,
    });
};

/**
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
 * @param client
 * @param privateKey
 * @param entryPoint
 * @param index
 * @param factoryAddress
 * @param accountLogicAddress
 * @param webAuthNValidatorAddress
 * @param deployedAccountAddress
 */
export async function webAuthNSmartAccount<
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
>(
    client: Client<TTransport, TChain>,
    {
        signerPubKey,
        signatureProvider,
        entryPoint = KERNEL_ADDRESSES.ENDTRYPOINT_V0_6,
        index = 0n,
        factoryAddress = KERNEL_ADDRESSES.FACTORY,
        accountLogicAddress = KERNEL_ADDRESSES.ACCOUNT_V3_LOGIC,
        webAuthNValidatorAddress = KERNEL_ADDRESSES.WEB_AUTHN_VALIDATOR,
        deployedAccountAddress,
    }: {
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        entryPoint?: Address;
        index?: bigint;
        factoryAddress?: Address;
        accountLogicAddress?: Address;
        webAuthNValidatorAddress?: Address;
        deployedAccountAddress?: Address;
    }
): Promise<KernelP256SmartAccount<TTransport, TChain>> {
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        getAccountInitCode({
            signerPubKey,
            index,
            factoryAddress,
            accountLogicAddress,
            webAuthNValidatorAddress,
        });

    // Fetch account address and chain id
    const [accountAddress, chainId] = await Promise.all([
        getAccountAddress<TTransport, TChain>({
            client,
            entryPoint,
            signerPubKey,
            webAuthNValidatorAddress,
            initCodeProvider: generateInitCode,
            deployedAccountAddress,
        }),
        getChainId(client),
    ]);

    if (!accountAddress) throw new Error("Account address not found");

    // Build the EOA Signer
    const account = toAccount({
        address: accountAddress,
        async signMessage({ message }) {
            // Encode the msg
            const challenge = hashMessage(message);
            // Sign it
            const {
                authenticatorData,
                clientData,
                challengeOffset,
                signature,
            } = await signatureProvider(challenge);

            // Return the encoded stuff for the web auth n validator
            return encodeAbiParameters(
                [
                    { name: "authenticatorData", type: "bytes" },
                    { name: "clientData", type: "bytes" },
                    { name: "challengeOffset", type: "uint256" },
                    { name: "rs", type: "uint256[2]" },
                ],
                [
                    authenticatorData,
                    clientData,
                    challengeOffset,
                    [BigInt(signature.r), BigInt(signature.s)],
                ]
            );
        },
        async signTransaction(_, __) {
            throw new SignTransactionNotSupportedBySmartAccount();
        },
        async signTypedData() {
            throw new SignTransactionNotSupportedBySmartAccount();
        },
    });

    return {
        ...account,
        client: client,
        publicKey: accountAddress,
        entryPoint: entryPoint,
        source: "kernelWebAuthNSmartAccount",

        // Get the nonce of the smart account
        async getNonce() {
            return getAccountNonce(client, {
                sender: accountAddress,
                entryPoint: entryPoint,
            });
        },

        // Sign a user operation
        async signUserOperation(userOperation) {
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    signature: "0x",
                },
                entryPoint: entryPoint,
                chainId: chainId,
            });

            // Sign the hash with the P256 signer
            const {
                authenticatorData,
                clientData,
                challengeOffset,
                signature,
            } = await signatureProvider(hash);

            // Encode the signature with the web auth n validator info
            const encodedSignature = encodeAbiParameters(
                [
                    { name: "authenticatorData", type: "bytes" },
                    { name: "clientData", type: "bytes" },
                    { name: "challengeOffset", type: "uint256" },
                    { name: "rs", type: "uint256[2]" },
                ],
                [
                    authenticatorData,
                    clientData,
                    challengeOffset,
                    [BigInt(signature.r), BigInt(signature.s)],
                ]
            );

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },

        // Encode the init code
        async getInitCode() {
            const contractCode = await getBytecode(client, {
                address: accountAddress,
            });

            if ((contractCode?.length ?? 0) > 2) return "0x";

            return generateInitCode();
        },

        // Encode the deploy call data
        async encodeDeployCallData(_) {
            throw new Error(
                "Simple account doesn't support account deployment"
            );
        },

        // Encode a call
        async encodeCallData(_tx) {
            if (Array.isArray(_tx)) {
                // Encode a batched call
                return encodeFunctionData({
                    abi: KernelExecuteAbi,
                    functionName: "executeBatch",
                    args: [
                        _tx.map((tx) => ({
                            to: tx.to,
                            value: tx.value,
                            data: tx.data,
                        })),
                    ],
                });
            } else {
                // Encode a simple call
                return encodeFunctionData({
                    abi: KernelExecuteAbi,
                    functionName: "execute",
                    args: [_tx.to, _tx.value, _tx.data, 0],
                });
            }
        },

        // Get simple dummy signature
        async getDummySignature() {
            // The max curve value for p256 signature stuff
            const maxCurveValue =
                BigInt(
                    "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
                ) - 1n;

            // Generate a template signature for the webauthn validator
            const sig = encodeAbiParameters(
                [
                    { name: "authenticatorData", type: "bytes" },
                    { name: "clientData", type: "bytes" },
                    { name: "challengeOffset", type: "uint256" },
                    { name: "rs", type: "uint256[2]" },
                ],
                [
                    // Randon 120 byte
                    `0x${maxUint256.toString(16).repeat(2)}`,
                    `0x${maxUint256.toString(16).repeat(6)}`,
                    maxUint256,
                    [maxCurveValue, maxCurveValue],
                ]
            );

            // return the coded signature
            return concatHex(["0x00000000", sig]);
        },
    };
}
