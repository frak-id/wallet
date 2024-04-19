import { kernelAddresses } from "@/context/common/blockchain/addresses";
import {
    KernelExecuteAbi,
    KernelInitAbi,
} from "@/context/wallet/abi/KernelAccountAbi";
import {
    type AccountMetadata,
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/context/wallet/smartWallet/signature";
import { isRip7212ChainSupported } from "@/context/wallet/smartWallet/webAuthN";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import {
    ENTRYPOINT_ADDRESS_V06,
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
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
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
    hashTypedData,
    keccak256,
    maxUint256,
    toHex,
} from "viem";

export type NexusSmartAccount<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<
    ENTRYPOINT_ADDRESS_V06_TYPE,
    "nexusSmartAccount",
    transport,
    chain
>;

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
const getAccountInitCode = async ({
    authenticatorIdHash,
    signerPubKey,
}: {
    authenticatorIdHash: Hex;
    signerPubKey: P256PubKey;
}): Promise<Hex> => {
    if (!signerPubKey) throw new Error("Owner account not found");

    const encodedPublicKey = encodeAbiParameters(
        webAuthNValidatorEnablingLayout,
        [authenticatorIdHash, BigInt(signerPubKey.x), BigInt(signerPubKey.y)]
    );

    // Build the account initialization data
    const initialisationData = encodeFunctionData({
        abi: KernelInitAbi,
        functionName: "initialize",
        args: [kernelAddresses.multiWebAuthnValidator, encodedPublicKey],
    });

    // Build the account init code
    return encodeFunctionData({
        abi: createAccountAbi,
        functionName: "createAccount",
        args: [kernelAddresses.accountLogic, initialisationData, 0n],
    }) as Hex;
};

/**
 * Check the validity of an existing account address, or fetch the pre-deterministic account address for a kernel smart wallet
 * @param client
 * @param signerPubKey
 * @param initCodeProvider
 * @param deployedAccountAddress
 */
const getAccountAddress = async <
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>({
    client,
    signerPubKey,
    initCodeProvider,
    deployedAccountAddress,
}: {
    client: Client<TTransport, TChain>;
    signerPubKey: P256PubKey;
    initCodeProvider: () => Promise<Hex>;
    deployedAccountAddress?: Address;
}): Promise<Address> => {
    // If we got an already deployed account, ensure it's well deployed, and the validator & signer are correct
    if (deployedAccountAddress !== undefined) {
        // TODO: Check the pub key match
        console.log("TODO: Check the pub key match", signerPubKey);
        // If ok, return the address
        return deployedAccountAddress;
    }

    // Find the init code for this account
    const initCode = await initCodeProvider();

    // Get the sender address based on the init code
    return getSenderAddress(client, {
        initCode: concatHex([kernelAddresses.factory, initCode]),
        entryPoint: ENTRYPOINT_ADDRESS_V06,
    });
};

/**
 * Represent the layout of the calldata used for a webauthn signature
 * TODO: Need to work on the custom encoding to reduce calldata
 */
const webAuthNSignatureLayoutParam = [
    // Metadata
    { name: "useOnChainP256Verifier", type: "bool" },
    { name: "authenticatorIdHash", type: "bytes32" },
    // Raw sig subtype
    {
        name: "fclSignature",
        type: "tuple",
        components: [
            { name: "authenticatorData", type: "bytes" },
            { name: "clientData", type: "bytes" },
            { name: "challengeOffset", type: "uint256" },
            { name: "rs", type: "uint256[2]" },
        ],
    },
] as const;

/**
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
 * @param client
 * @param authenticatorId
 * @param signerPubKey
 * @param signatureProvider
 * @param deployedAccountAddress
 */
export async function nexusSmartAccount<
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>(
    client: Client<TTransport, TChain>,
    {
        authenticatorId,
        signerPubKey,
        signatureProvider,
        deployedAccountAddress,
    }: {
        authenticatorId: string;
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        deployedAccountAddress?: Address;
    }
): Promise<NexusSmartAccount<TTransport, TChain>> {
    const authenticatorIdHash = keccak256(toHex(authenticatorId));
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        getAccountInitCode({
            authenticatorIdHash,
            signerPubKey,
        });

    // Fetch account address and chain id
    const accountAddress = await getAccountAddress({
        client,
        signerPubKey,
        initCodeProvider: generateInitCode,
        deployedAccountAddress,
    });

    if (!accountAddress) throw new Error("Account address not found");

    // Helper to check if the smart account is already deployed (with caching)
    let smartAccountDeployed = false;
    const isKernelAccountDeployed = async () => {
        if (smartAccountDeployed) return true;
        smartAccountDeployed = await isSmartAccountDeployed(
            client,
            accountAddress
        );
        return smartAccountDeployed;
    };

    // Helper fetching the account metadata (used for msg signing)
    let accountMetadata: AccountMetadata | undefined = undefined;
    const getAccountMetadata = async () => {
        if (accountMetadata) return accountMetadata;
        // Fetch the account metadata
        accountMetadata = await fetchAccountMetadata(client, accountAddress);
        return accountMetadata;
    };

    // Helper to perform a signature of a hash
    const isRip7212Supported = isRip7212ChainSupported(client.chain.id);
    const signHash = async (hash: Hex) => {
        // Sign the hash with the sig provider
        const { authenticatorData, clientData, challengeOffset, signature } =
            await signatureProvider(hash);

        // Encode the signature with the web auth n validator info
        return encodeAbiParameters(webAuthNSignatureLayoutParam, [
            isRip7212Supported,
            authenticatorIdHash,
            {
                // Random 120 byte
                authenticatorData,
                clientData,
                challengeOffset,
                rs: [BigInt(signature.r), BigInt(signature.s)],
            },
        ]);
    };

    // Build the smart account itself
    return toSmartAccount({
        address: accountAddress,

        client: client,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        source: "nexusSmartAccount",

        /**
         * Get the smart account nonce
         */
        async getNonce() {
            return getAccountNonce(client, {
                sender: accountAddress,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
            });
        },

        /**
         * Get the smart account factory
         */
        async getFactory() {
            if (await isKernelAccountDeployed()) return undefined;
            return kernelAddresses.factory;
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
            return concatHex([
                kernelAddresses.factory,
                await generateInitCode(),
            ]);
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
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chainId: client.chain.id,
            });
            const encodedSignature = await signHash(hash);

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },

        /**
         * Sign a message
         * @param message
         */
        async signMessage({ message }) {
            const metadata = await getAccountMetadata();
            // Encode the msg and wrap it
            const hashedMessage = hashMessage(message);
            const challenge = wrapMessageForSignature({
                message: hashedMessage,
                metadata,
            });
            // And sign it
            return signHash(challenge);
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
        async signTypedData(typedData) {
            const metadata = await getAccountMetadata();
            // Encode the msg and wrap it
            const typedDataHash = hashTypedData(typedData);
            const challenge = wrapMessageForSignature({
                message: typedDataHash,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },

        /**
         * Encode the deployment call data of this account
         * TODO: It's supported, just need to dev it
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
                isRip7212Supported,
                authenticatorIdHash,
                {
                    // Random 120 byte
                    authenticatorData: `0x${maxUint256.toString(16).repeat(6)}`,
                    clientData: `0x${maxUint256.toString(16).repeat(12)}`,
                    challengeOffset: maxUint256,
                    rs: [maxCurveValue, maxCurveValue],
                },
            ]);

            // return the coded signature
            return concatHex(["0x00000000", sig]);
        },
    });
}
