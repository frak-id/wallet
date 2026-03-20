import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    bufferToBase64URLString,
    bytesToBase64URLString,
} from "@frak-labs/wallet-shared/common/utils/base64url";
import { useCallback, useState } from "react";
import type { Address } from "viem";
import { useSignMessage } from "wagmi";
import {
    moneriumStore,
    selectIsConnected,
} from "@/module/monerium/store/moneriumStore";
import {
    ADDRESS_LINKING_MESSAGE,
    MONERIUM_AUTH_BASE_URL,
    moneriumConfig,
} from "@/module/monerium/utils/moneriumConfig";

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

export const useMoneriumAuth = () => {
    const { signMessageAsync } = useSignMessage();
    const [isConnecting, setIsConnecting] = useState(false);

    const isConnected = moneriumStore(selectIsConnected);

    const connect = useCallback(
        async (walletAddress: Address) => {
            setIsConnecting(true);

            try {
                const codeVerifier = createCodeVerifier();
                const codeChallenge = await createCodeChallenge(codeVerifier);
                const state = createStateNonce();

                moneriumStore.getState().setPendingCodeVerifier(codeVerifier);

                let signature: `0x${string}` | "0x" = "0x";

                try {
                    signature = await signMessageAsync({
                        message: ADDRESS_LINKING_MESSAGE,
                    });
                } catch {
                    signature = "0x";
                }

                const searchParams = new URLSearchParams({
                    client_id: moneriumConfig.clientId,
                    redirect_uri: moneriumConfig.redirectUri,
                    response_type: "code",
                    code_challenge: codeChallenge,
                    code_challenge_method: "S256",
                    state,
                    address: walletAddress,
                    signature,
                    chain: moneriumConfig.chain,
                });

                const authUrl = `${getMoneriumAuthBaseUrl()}?${searchParams.toString()}`;

                if (isTauri()) {
                    window.open(authUrl, "_blank");
                    return;
                }

                window.location.assign(authUrl);
            } finally {
                setIsConnecting(false);
            }
        },
        [signMessageAsync]
    );

    const disconnect = useCallback(() => {
        moneriumStore.getState().disconnect();
    }, []);

    return {
        connect,
        disconnect,
        isConnecting,
        isConnected,
    };
};
