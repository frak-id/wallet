import {
    addresses,
    getExecutionAbi,
} from "@frak-labs/app-essentials/blockchain";
import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { currentViemClient, setExecutionAbi } from "@frak-labs/wallet-shared";
import {
    bufferToBase64URLString,
    bytesToBase64URLString,
} from "@frak-labs/wallet-shared/common/utils/base64url";
import { useMutation } from "@tanstack/react-query";
import {
    type Address,
    encodeFunctionData,
    keccak256,
    stringToHex,
    toFunctionSelector,
} from "viem";
import { readContract, waitForTransactionReceipt } from "viem/actions";
import { useAccount, useSendTransaction } from "wagmi";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import {
    ADDRESS_LINKING_MESSAGE,
    MONERIUM_AUTH_BASE_URL,
    moneriumConfig,
} from "@/module/monerium/utils/moneriumConfig";
import {
    moneriumSignMsgActionAbi,
    signMessageFnAbi,
    signMessageRawFnAbi,
} from "@/module/monerium/utils/moneriumSignMsgAbi";

type SigningMethod = "signMessage" | "signMessageRaw";

const createCodeVerifier = () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return bytesToBase64URLString(randomBytes);
};

const createStateNonce = () => {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    return bytesToBase64URLString(randomBytes);
};

const createCodeChallenge = async (codeVerifier: string) => {
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(codeVerifier)
    );
    return bufferToBase64URLString(hashBuffer);
};

const getMoneriumAuthBaseUrl = () =>
    MONERIUM_AUTH_BASE_URL[moneriumConfig.environment];

async function isExtensionInstalled({
    wallet,
    method,
}: {
    wallet: Address;
    method: SigningMethod;
}) {
    const fnAbi =
        method === "signMessage" ? signMessageFnAbi : signMessageRawFnAbi;
    const selector = toFunctionSelector(fnAbi);

    try {
        const execution = await readContract(currentViemClient, {
            address: wallet,
            abi: [getExecutionAbi],
            functionName: "getExecution",
            args: [selector],
        });
        return (
            execution.executor.toLowerCase() ===
            addresses.moneriumSignMsgAction.toLowerCase()
        );
    } catch {
        return false;
    }
}

function buildSetExecutionData(method: SigningMethod) {
    const fnAbi =
        method === "signMessage" ? signMessageFnAbi : signMessageRawFnAbi;
    const selector = toFunctionSelector(fnAbi);

    return encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            selector,
            addresses.moneriumSignMsgAction,
            addresses.webAuthNValidator,
            0,
            0,
            "0x",
        ],
    });
}

function buildSigningCallData(method: SigningMethod) {
    if (method === "signMessage") {
        return encodeFunctionData({
            abi: moneriumSignMsgActionAbi,
            functionName: "signMessage",
            args: [stringToHex(ADDRESS_LINKING_MESSAGE)],
        });
    }

    return encodeFunctionData({
        abi: moneriumSignMsgActionAbi,
        functionName: "signMessageRaw",
        args: [keccak256(stringToHex(ADDRESS_LINKING_MESSAGE))],
    });
}

export function useMoneriumOnchainSign() {
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationFn: async ({ method }: { method: SigningMethod }) => {
            if (!address) throw new Error("No wallet connected");

            // Step 1: Install kernel extension if needed
            const installed = await isExtensionInstalled({
                wallet: address,
                method,
            });

            if (!installed) {
                const installTxHash = await sendTransactionAsync({
                    to: address,
                    data: buildSetExecutionData(method),
                });
                await waitForTransactionReceipt(currentViemClient, {
                    hash: installTxHash,
                });
            }

            // Step 2: Call signMessage or signMessageRaw (emits SignMsg event via delegatecall)
            const signTxHash = await sendTransactionAsync({
                to: address,
                data: buildSigningCallData(method),
            });
            await waitForTransactionReceipt(currentViemClient, {
                hash: signTxHash,
            });

            // Step 3: Redirect to Monerium OAuth with "0x" signature (onchain ERC-1271)
            const codeVerifier = createCodeVerifier();
            const codeChallenge = await createCodeChallenge(codeVerifier);
            const state = createStateNonce();

            moneriumStore.getState().setPendingCodeVerifier(codeVerifier);

            const searchParams = new URLSearchParams({
                client_id: moneriumConfig.clientId,
                redirect_uri: moneriumConfig.redirectUri,
                response_type: "code",
                code_challenge: codeChallenge,
                code_challenge_method: "S256",
                state,
                address,
                signature: "0x",
                chain: moneriumConfig.chain,
            });

            const authUrl = `${getMoneriumAuthBaseUrl()}?${searchParams.toString()}`;

            if (isTauri()) {
                window.open(authUrl, "_blank");
                return signTxHash;
            }

            window.location.assign(authUrl);
            return signTxHash;
        },
    });

    return {
        signOnchain: mutate,
        signOnchainAsync: mutateAsync,
        ...mutationStuff,
    };
}
