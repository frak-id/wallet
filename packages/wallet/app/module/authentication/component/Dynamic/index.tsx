import { authenticatedBackendApi } from "@/context/common/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import {
    DynamicConnectButton,
    type Wallet,
    useIsLoggedIn,
    useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import { jotaiStore } from "@module/atoms/store";
import { Button } from "@module/component/Button";
import { trackEvent } from "@module/utils/trackEvent";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

export function DynamicLogin() {
    return (
        <>
            <DoDynamicLogin />
            <br />
            <br />
            <DoDynamicAuthentication />
        </>
    );
}

function DoDynamicLogin() {
    const isLoggedIn = useIsLoggedIn();
    if (isLoggedIn) {
        return null;
    }
    return <DynamicConnectButton>Connect via socials</DynamicConnectButton>;
}

function DoDynamicAuthentication() {
    const userWallets = useUserWallets();
    const [wallet, setWallet] = useState<Wallet | undefined>(undefined);

    // Auto pick the first wallet
    useEffect(() => {
        if (userWallets.length === 1) {
            setWallet(userWallets[0]);
        }
    }, [userWallets]);

    const { mutate: authenticate } = useMutation({
        mutationKey: ["ecdsa-login", wallet?.address],
        async mutationFn() {
            if (!wallet) {
                throw new Error("No wallet selected");
            }

            // Generate a random challenge
            const challenge = generatePrivateKey();

            // Build the message to sign
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Launch the signature
            const signature = (await wallet.signMessage(message)) as
                | Hex
                | undefined;
            if (!signature) {
                console.warn("No signature");
                throw new Error("No signature returned");
            }

            // Launch the backend authentication process
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.ecdsaLogin.post({
                    expectedChallenge: challenge,
                    signature,
                    wallet: wallet.address as Address,
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
            {!wallet && userWallets.length > 0 && (
                <PickDynamicWallet wallets={userWallets} onPick={setWallet} />
            )}
            <Button
                type={"button"}
                onClick={() => authenticate()}
                disabled={wallet === undefined}
            >
                Authenticate
            </Button>
        </>
    );
}

function PickDynamicWallet({
    wallets,
    onPick,
}: { wallets: Wallet[]; onPick: (args: Wallet) => void }) {
    return (
        <div>
            Pick the wallet to use on Frak
            {wallets.map((wallet) => {
                return (
                    <Button key={wallet.address} onClick={() => onPick(wallet)}>
                        {wallet.address}
                    </Button>
                );
            })}
        </div>
    );
}
