import { authenticatedBackendApi } from "@/context/common/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@module/atoms/store";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { trackEvent } from "@module/utils/trackEvent";
import {
    type ConnectedWallet,
    usePrivy,
    useWallets,
} from "@privy-io/react-auth";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

export function PrivyLogin() {
    const { ready } = usePrivy();

    if (!ready) {
        return <Spinner />;
    }

    return (
        <>
            <DoPrivyLogin />
            <br />
            <br />
            <DoPrivyAuthentication />
        </>
    );
}

function DoPrivyLogin() {
    // todo: Maybe a fork session stuff for the SDK post SSO?
    const { login, authenticated } = usePrivy();

    return (
        <Button
            type={"button"}
            onClick={() => login()}
            disabled={authenticated}
        >
            Connect via socials
        </Button>
    );
}

function DoPrivyAuthentication() {
    const { signMessage } = usePrivy();
    const { wallets } = useWallets();
    const [wallet, setWallet] = useState<ConnectedWallet | undefined>(
        undefined
    );

    // Auto pick the first wallet
    useEffect(() => {
        if (wallets.length === 1) {
            setWallet(wallets[0]);
        }
    }, [wallets]);

    const { mutate: authenticate } = useMutation({
        mutationKey: ["privy-login", wallet?.address],
        async mutationFn() {
            if (!wallet) {
                throw new Error("No wallet selected");
            }

            // Generate a random challenge
            const challenge = generatePrivateKey();

            // Build the message to sign
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Do the message signature
            const signature = (await signMessage(
                message,
                {
                    title: "Frak authentication",
                    description:
                        "After this message approval, you will be logged in",
                },
                wallet.address
            )) as Hex;

            // Launch the backend authentication process
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.privyLogin.post({
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
            trackEvent("cta-privy-login");
        },
    });

    return (
        <>
            {!wallet && wallets.length > 0 && (
                <PickPrivyWallet wallets={wallets} onPick={setWallet} />
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

function PickPrivyWallet({
    wallets,
    onPick,
}: { wallets: ConnectedWallet[]; onPick: (args: ConnectedWallet) => void }) {
    return (
        <div>
            Pick a privy wallet
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
