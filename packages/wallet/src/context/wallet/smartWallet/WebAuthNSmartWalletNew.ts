import {
    DeployWithFactoryAbi,
    KernelV3Execute,
    KernelV3InitAbi,
} from "@/context/wallet/abi/KernelV3Abi";
import {
    type AccountMetadata,
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/context/wallet/smartWallet/signature";
import { isRip7212ChainSupported } from "@/context/wallet/smartWallet/webAuthN";
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
import type { ENTRYPOINT_ADDRESS_V07_TYPE } from "permissionless/types";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concat,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    hashMessage,
    hashTypedData,
    keccak256,
    maxUint256,
    pad,
    toHex,
    zeroAddress,
} from "viem";

export type KernelWebAuthNSmartAccount<
    entryPoint extends
        ENTRYPOINT_ADDRESS_V07_TYPE = ENTRYPOINT_ADDRESS_V07_TYPE,
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<entryPoint, "NexusWebAuthNSmartAccount", transport, chain>;

/**
 * Default addresses for kernel smart account
 */
const KERNEL_ADDRESSES: {
    WEB_AUTHN_VALIDATOR: Address;
    FACTORY_WITH_STAKE: Address;
    FACTORY: Address;
} = {
    // Validators
    WEB_AUTHN_VALIDATOR: "0x39ea8C5Ec02E670c750076F468234e7194A7EBb7",
    // Kernel stuff
    FACTORY_WITH_STAKE: "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
    FACTORY: "0x6723b44Abeec4E71eBE3232BD5B455805baDD22f",
};

const batchExecuteLayout = [
    {
        name: "executionBatch",
        type: "tuple[]",
        components: [
            {
                name: "target",
                type: "address",
            },
            {
                name: "value",
                type: "uint256",
            },
            {
                name: "callData",
                type: "bytes",
            },
        ],
    },
] as const;

/**
 * Represent the layout of the calldata used for a webauthn signature
 */
export const webAuthNValidatorEnablingLayout = [
    { name: "authenticatorIdHash", type: "bytes32" },
    { name: "x", type: "uint256" },
    { name: "y", type: "uint256" },
] as const;

/**
 * Get the account initialization code for a kernel smart account
 * @param authenticatorId
 * @param signerPubKey
 * @param index
 * @param accountLogicAddress
 * @param webAuthNValidatorAddress
 */
const getAccountInitCode = async ({
    authenticatorId,
    signerPubKey,
    index,
    factoryAddress,
    webAuthNValidatorAddress,
}: {
    authenticatorId: string;
    signerPubKey: P256PubKey;
    index: bigint;
    factoryAddress: Address;
    webAuthNValidatorAddress: Address;
}): Promise<Hex> => {
    console.log("Fetching init code");
    if (!signerPubKey) throw new Error("Owner account not found");

    console.log("Encoding public key init code");
    const encodedPublicKey = encodeAbiParameters(
        webAuthNValidatorEnablingLayout,
        [
            keccak256(toHex(authenticatorId)),
            BigInt(signerPubKey.x),
            BigInt(signerPubKey.y),
        ]
    );

    // Build the account initialization data
    console.log("Generating initialisation data");
    const validatorIdentifier = pad(
        concat([
            // Validation type validator
            "0x01",
            // WebAuthN Validator
            webAuthNValidatorAddress,
        ]),
        { size: 21, dir: "right" }
    );
    const initialisationData = encodeFunctionData({
        abi: KernelV3InitAbi,
        functionName: "initialize",
        args: [validatorIdentifier, zeroAddress, encodedPublicKey, "0x"],
    });
    console.log("initialisationData", {
        initialisationData,
        validatorIdentifier,
        encodedPublicKey,
    });

    // Build the account init code
    return encodeFunctionData({
        abi: DeployWithFactoryAbi,
        functionName: "deployWithFactory",
        args: [factoryAddress, initialisationData, toHex(index, { size: 32 })],
    });
};

/**
 * Check the validity of an existing account address, or fetch the pre-deterministic account address for a kernel smart wallet
 * @param client
 * @param signerPubKey
 * @param entryPoint
 * @param factoryAddress
 * @param webAuthNValidatorAddress
 * @param initCodeProvider
 * @param deployedAccountAddress
 */
const getAccountAddress = async <
    TEntryPoint extends ENTRYPOINT_ADDRESS_V07_TYPE,
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
    entryPoint: TEntryPoint;
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
    console.log("fetching init code");
    const initCode = await initCodeProvider();

    // Get the sender address based on the init code
    const address = await getSenderAddress(client, {
        factory: factoryAddress,
        factoryData: initCode,
        entryPoint,
    });
    console.log("address", {
        address,
        factoryAddress,
        initCode,
        entryPoint,
        allConcat: concat([factoryAddress, initCode]),
    });
    return address;
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
 * @param webAuthNValidatorAddress
 * @param deployedAccountAddress
 */
export async function nexusSmartAccount<
    TEntryPoint extends ENTRYPOINT_ADDRESS_V07_TYPE,
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>(
    client: Client<TTransport, TChain>,
    {
        authenticatorId,
        signerPubKey,
        signatureProvider,
        entryPoint,
        index = 0n,
        factoryAddress = KERNEL_ADDRESSES.FACTORY,
        metaFactoryAddress = KERNEL_ADDRESSES.FACTORY_WITH_STAKE,
        webAuthNValidatorAddress = KERNEL_ADDRESSES.WEB_AUTHN_VALIDATOR,
        deployedAccountAddress,
    }: {
        authenticatorId: string;
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        entryPoint: TEntryPoint;
        index?: bigint;
        factoryAddress?: Address;
        metaFactoryAddress?: Address;
        webAuthNValidatorAddress?: Address;
        deployedAccountAddress?: Address;
    }
): Promise<KernelWebAuthNSmartAccount<TEntryPoint, TTransport, TChain>> {
    // Helper to generate the init code for the smart account
    let initCode: Hex | undefined;
    async function getInitCode() {
        if (initCode) return initCode;
        initCode = await getAccountInitCode({
            authenticatorId,
            signerPubKey,
            index,
            factoryAddress,
            webAuthNValidatorAddress,
        });
        return initCode;
    }

    // Fetch account address and chain id
    const accountAddress = await getAccountAddress({
        client,
        entryPoint,
        factoryAddress: metaFactoryAddress,
        signerPubKey,
        webAuthNValidatorAddress,
        initCodeProvider: getInitCode,
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
        console.log("Asking to sign the given hash", hash);
        // Sign the hash with the sig provider
        const { authenticatorData, clientData, challengeOffset, signature } =
            await signatureProvider(hash);

        // Encode the signature with the web auth n validator info
        return encodeAbiParameters(webAuthNSignatureLayoutParam, [
            !isRip7212Supported,
            authenticatorData,
            clientData,
            challengeOffset,
            [BigInt(signature.r), BigInt(signature.s)],
        ]);
    };

    // Build the smart account itself
    return toSmartAccount({
        address: accountAddress,

        client: client,
        entryPoint: entryPoint,
        source: "NexusWebAuthNSmartAccount",

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
            return metaFactoryAddress;
        },

        /**
         * Get the smart account factory data
         */
        async getFactoryData() {
            if (await isKernelAccountDeployed()) return undefined;
            return getInitCode();
        },

        /**
         * Generate the account init code
         */
        async getInitCode() {
            if (await isKernelAccountDeployed()) return "0x";
            return concatHex([factoryAddress, await getInitCode()]);
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
        async signUserOperation(userOperation) {
            console.log("Asking for user op signature", userOperation);
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    signature: "0x",
                },
                entryPoint: entryPoint,
                chainId: client.chain.id,
            });
            return await signHash(hash);
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
            console.log("Encoding call data", { _tx });
            if (Array.isArray(_tx)) {
                // Build the execution type
                const executionType = concatHex([
                    "0x01", // 1 byte -> CallType.Batch
                    "0x00", // 1 byte -> ExecType.Default
                    "0x00000000", // 4 bytes
                    "0x00000000", // 4 bytes
                    pad("0x00000000", { size: 22 }),
                ]);
                const executionData = encodeAbiParameters(batchExecuteLayout, [
                    _tx.map((tx) => ({
                        target: tx.to,
                        value: tx.value,
                        callData: tx.data,
                    })),
                ]);

                // Encode a batched call
                return encodeFunctionData({
                    abi: KernelV3Execute,
                    functionName: "execute",
                    args: [executionType, executionData],
                });
            }
            // Build the execution type
            const executionType = concatHex([
                "0x00", // 1 byte -> CallType.Single
                "0x00", // 1 byte -> ExecType.Default
                "0x00000000", // 4 bytes
                "0x00000000", // 4 bytes
                pad("0x00000000", { size: 22 }),
            ]);
            const executionData = concatHex([
                _tx.to,
                toHex(_tx.value, { size: 32 }),
                _tx.data,
            ]);
            // Encode a simple call
            const encodedExecute = encodeFunctionData({
                abi: KernelV3Execute,
                functionName: "execute",
                args: [executionType, executionData],
            });
            console.log("Execution stuff", {
                executionData,
                executionType,
                encodedExecute,
            });
            return encodedExecute;
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
            return encodeAbiParameters(webAuthNSignatureLayoutParam, [
                true,
                // Random 120 byte
                `0x${maxUint256.toString(16).repeat(2)}`,
                `0x${maxUint256.toString(16).repeat(6)}`,
                maxUint256,
                [maxCurveValue, maxCurveValue],
            ]);
        },
    });
}
