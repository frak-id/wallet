import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    bufferToBase64URLString,
    bytesToBase64URLString,
} from "@frak-labs/wallet-shared/common/utils/base64url";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Address } from "viem";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import {
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
    const [isConnecting, setIsConnecting] = useState(false);
    const queryClient = useQueryClient();

    const isConnected = moneriumStore(isMoneriumConnected);

    const connect = useCallback(async (walletAddress: Address) => {
        setIsConnecting(true);

        try {
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
                address: walletAddress,
                signature: "0x",
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
    }, []);

    const disconnect = useCallback(() => {
        moneriumStore.getState().disconnect();
        queryClient.invalidateQueries({
            queryKey: moneriumKey.all,
        });
    }, [queryClient]);

    return {
        connect,
        disconnect,
        isConnecting,
        isConnected,
    };
};
