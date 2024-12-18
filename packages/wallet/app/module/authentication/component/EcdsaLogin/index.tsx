import { crossAppClient } from "@/context/blockchain/privy-cross-client";
import { authenticatedBackendApi } from "@/context/common/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { isCrossAppWalletLoggedInQuery } from "@/module/common/hook/crossAppPrivyHooks";
import { jotaiStore } from "@module/atoms/store";
import { Button } from "@module/component/Button";
import { trackEvent } from "@module/utils/trackEvent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey } from "viem/accounts";

export function EcdsaLogin() {
    const { data: isLoggedIn } = useQuery(isCrossAppWalletLoggedInQuery);

    if (isLoggedIn) {
        return <DoEcdsaLogin />;
    }
    return <DoEcdsaAuthentication />;
}

function DoEcdsaLogin() {
    const queryClient = useQueryClient();
    const { mutate: logIn, isPending } = useMutation({
        mutationKey: ["privy-cross-app", "connect"],
        async mutationFn() {
            await crossAppClient.requestConnection();
            await queryClient.invalidateQueries({
                queryKey: ["privy-cross-app"],
                exact: false,
            });
        },
    });

    return (
        <Button type={"button"} onClick={() => logIn()} disabled={isPending}>
            Connect via Privy
        </Button>
    );
}

function DoEcdsaAuthentication() {
    const { mutate: authenticate, isPending } = useMutation({
        mutationKey: ["privy-cross-app", "authenticate"],
        async mutationFn() {
            const wallet = crossAppClient.address;
            if (!wallet) {
                throw new Error("No wallet selected");
            }

            // Generate a random challenge
            const challenge = generatePrivateKey();

            // Build the message to sign
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Launch the signature
            const signature = (await crossAppClient.sendRequest(
                "personal_sign",
                [stringToHex(message), wallet]
            )) as Hex | undefined;
            if (!signature) {
                console.warn("No signature");
                throw new Error("No signature returned");
            }

            // Launch the backend authentication process
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.ecdsaLogin.post({
                    expectedChallenge: challenge,
                    signature,
                    wallet: wallet as Address,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token };

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Track the event
            trackEvent("cta-ecdsa-login");
        },
    });

    return (
        <>
            <Button
                type={"button"}
                onClick={() => authenticate()}
                disabled={isPending}
            >
                Authenticate
            </Button>
        </>
    );
}
