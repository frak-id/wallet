import {
    KernelExecuteAbi,
    KernelInitAbi,
} from "@/context/wallet/abi/KernelAccountAbi";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import {
    getAccountNonce,
    getSenderAddress,
    getUserOperationHash,
    isSmartAccountDeployed,
} from "permissionless";
import {
    SignTransactionNotSupportedBySmartAccount,
    type SmartAccount,
    toSmartAccount,
} from "permissionless/accounts";
import type {
    ENTRYPOINT_ADDRESS_V06_TYPE,
    EntryPoint,
} from "permissionless/types";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    encodePacked,
    hashMessage,
    maxUint256,
} from "viem";
import { getChainId } from "viem/actions";

export type KernelWebAuthNSmartAccount<
    entryPoint extends
        ENTRYPOINT_ADDRESS_V06_TYPE = ENTRYPOINT_ADDRESS_V06_TYPE,
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<entryPoint, "kernelWebAuthNSmartAccount", transport, chain>;

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
 *   validator address: 0xB38806b3b3aE69271b2A57319E21998A41A1d82d
 */
const KERNEL_ADDRESSES: {
    WEB_AUTHN_VALIDATOR: Address;
    ACCOUNT_V4_LOGIC: Address;
    FACTORY: Address;
    ENDTRYPOINT_V0_6: ENTRYPOINT_ADDRESS_V06_TYPE;
} = {
    // Validators
    WEB_AUTHN_VALIDATOR: "0x07540183E6BE3b15B3bD50798385095Ff3D55cD5",
    // Kernel stuff
    ACCOUNT_V4_LOGIC: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    FACTORY: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
    // ERC-4337 stuff
    ENDTRYPOINT_V0_6: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

/**
 * Get the account initialization code for a kernel smart account
 * @param signerPubKey
 * @param index
 * @param accountLogicAddress
 * @param webAuthNValidatorAddress
 */
const getAccountInitCode = async ({
    signerPubKey,
    index,
    accountLogicAddress,
    webAuthNValidatorAddress,
}: {
    signerPubKey: P256PubKey;
    index: bigint;
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
    return encodeFunctionData({
        abi: createAccountAbi,
        functionName: "createAccount",
        args: [accountLogicAddress, initialisationData, index],
    }) as Hex;
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
    TChain extends Chain = Chain,
>({
    client,
    signerPubKey,
    entryPoint,
    factoryAddress,
    initCodeProvider,
    webAuthNValidatorAddress,
    deployedAccountAddress,
}: {
    client: Client<TTransport, TChain>;
    signerPubKey: P256PubKey;
    initCodeProvider: () => Promise<Hex>;
    entryPoint: EntryPoint;
    factoryAddress: Address;
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
        initCode: concatHex([factoryAddress, initCode]),
        entryPoint,
    });
};

/**
 * Represent the layout of the calldata used for a webauthn signature
 */
const webAuthNSignatureLayoutParam = [
    { name: "useOnChainP256Verifier", type: "bool" },
    { name: "authenticatorData", type: "bytes" },
    { name: "clientData", type: "bytes" },
    { name: "challengeOffset", type: "uint256" },
    { name: "rs", type: "uint256[2]" },
] as const;

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
    TEntryPoint extends ENTRYPOINT_ADDRESS_V06_TYPE,
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>(
    client: Client<TTransport, TChain>,
    {
        signerPubKey,
        signatureProvider,
        entryPoint = KERNEL_ADDRESSES.ENDTRYPOINT_V0_6,
        index = 0n,
        factoryAddress = KERNEL_ADDRESSES.FACTORY,
        accountLogicAddress = KERNEL_ADDRESSES.ACCOUNT_V4_LOGIC,
        webAuthNValidatorAddress = KERNEL_ADDRESSES.WEB_AUTHN_VALIDATOR,
        deployedAccountAddress,
    }: {
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        entryPoint?: TEntryPoint;
        index?: bigint;
        factoryAddress?: Address;
        accountLogicAddress?: Address;
        webAuthNValidatorAddress?: Address;
        deployedAccountAddress?: Address;
    }
): Promise<KernelWebAuthNSmartAccount<TEntryPoint, TTransport, TChain>> {
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        getAccountInitCode({
            signerPubKey,
            index,
            accountLogicAddress,
            webAuthNValidatorAddress,
        });

    // Fetch account address and chain id
    const [accountAddress, chainId] = await Promise.all([
        getAccountAddress({
            client,
            entryPoint,
            factoryAddress,
            signerPubKey,
            webAuthNValidatorAddress,
            initCodeProvider: generateInitCode,
            deployedAccountAddress,
        }),
        getChainId(client),
    ]);

    if (!accountAddress) throw new Error("Account address not found");

    // Check if the smart account is already deployed
    let smartAccountDeployed = await isSmartAccountDeployed(
        client,
        accountAddress
    );
    const isKernelAccountDeployed = async () => {
        if (smartAccountDeployed) return true;
        smartAccountDeployed = await isSmartAccountDeployed(
            client,
            accountAddress
        );
        return smartAccountDeployed;
    };

    return toSmartAccount({
        address: accountAddress,

        client: client,
        entryPoint: entryPoint,
        source: "kernelWebAuthNSmartAccount",

        /**
         * Get the smart account nonce
         */
        async getNonce() {
            return getAccountNonce(client, {
                sender: accountAddress,
                entryPoint: entryPoint,
            });
        },

        /**
         * Get the smart account factory
         */
        async getFactory() {
            if (await isKernelAccountDeployed()) return undefined;
            return factoryAddress;
        },

        /**
         * Get the smart account factory data
         */
        async getFactoryData() {
            if (await isKernelAccountDeployed()) return undefined;
            return generateInitCode();
        },

        /**
         * Generate the account init code
         */
        async getInitCode() {
            if (await isKernelAccountDeployed()) return "0x";
            return concatHex([factoryAddress, await generateInitCode()]);
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
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
                webAuthNSignatureLayoutParam,
                [
                    false,
                    authenticatorData,
                    clientData,
                    challengeOffset,
                    [BigInt(signature.r), BigInt(signature.s)],
                ]
            );

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },

        /**
         * Signe a message
         * @param message
         */
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
            return encodePacked(webAuthNSignatureLayoutParam, [
                false,
                authenticatorData,
                clientData,
                challengeOffset,
                [BigInt(signature.r), BigInt(signature.s)],
            ]);
        },

        /**
         * Sign a given transaction
         * @param _
         * @param __
         */
        async signTransaction(_, __) {
            throw new SignTransactionNotSupportedBySmartAccount();
        },

        /**
         * Sign typed data
         */
        async signTypedData() {
            throw new SignTransactionNotSupportedBySmartAccount();
        },

        /**
         * Encode the deployment call data of this account
         * @param _
         */
        async encodeDeployCallData(_) {
            throw new Error(
                "WebAuthN account doesn't support account deployment"
            );
        },

        /**
         * Encode transaction call data for this smart account
         * @param _tx
         */
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
            }
            // Encode a simple call
            return encodeFunctionData({
                abi: KernelExecuteAbi,
                functionName: "execute",
                args: [_tx.to, _tx.value, _tx.data, 0],
            });
        },

        /**
         * Get a dummy signature for this smart account
         */
        async getDummySignature() {
            // The max curve value for p256 signature stuff
            const maxCurveValue =
                BigInt(
                    "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
                ) - 1n;

            // Generate a template signature for the webauthn validator
            const sig = encodeAbiParameters(webAuthNSignatureLayoutParam, [
                false,
                // Random 120 byte
                `0x${maxUint256.toString(16).repeat(2)}`,
                `0x${maxUint256.toString(16).repeat(6)}`,
                maxUint256,
                [maxCurveValue, maxCurveValue],
            ]);

            // return the coded signature
            return concatHex(["0x00000000", sig]);
        },
    });
}
