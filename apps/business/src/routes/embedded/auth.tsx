import { WebAuthN } from "@frak-labs/app-essentials";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WebAuthnP256 } from "ox";
import { useTransition } from "react";
import { generatePrivateKey } from "viem/accounts";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAuthStore } from "@/stores/authStore";
import styles from "./auth.module.css";

export const Route = createFileRoute("/embedded/auth")({
    component: EmbeddedAuthPage,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            redirect: (search.redirect as string | undefined) ?? "/embedded",
        };
    },
});

function EmbeddedAuthPage() {
    const navigate = useNavigate();
    const { redirect } = Route.useSearch();
    const [isPending, startTransition] = useTransition();

    const isAuthenticatedInStore = useAuthStore((state) =>
        state.isAuthenticated()
    );

    const handleAuthenticate = async () => {
        startTransition(async () => {
            try {
                const challenge = generatePrivateKey();
                const { metadata, signature, raw } = await WebAuthnP256.sign({
                    rpId: WebAuthN.rpId,
                    userVerification: "required",
                    challenge,
                });

                const authenticationResponse = {
                    id: raw.id,
                    response: {
                        metadata,
                        signature,
                    },
                };

                const encodedResponse = btoa(
                    JSON.stringify(authenticationResponse)
                );

                const response = await authenticatedBackendApi.auth.login.post({
                    expectedChallenge: challenge,
                    authenticatorResponse: encodedResponse,
                });

                if (response.error) {
                    console.error("Login failed:", response.error);
                    return;
                }

                useAuthStore
                    .getState()
                    .setAuth(
                        response.data.token,
                        response.data.wallet,
                        response.data.expiresAt
                    );

                navigate({ to: redirect });
            } catch (error) {
                console.error("WebAuthn authentication error:", error);
            }
        });
    };

    if (isAuthenticatedInStore) {
        navigate({ to: redirect });
        return null;
    }

    if (isPending) {
        return (
            <div className={styles.container}>
                <Spinner />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Title className={styles.title}>Authentication required</Title>
            <Panel
                withBadge={false}
                title="Please connect your wallet to continue"
            >
                <Button
                    variant="secondary"
                    size="small"
                    className={styles.button}
                    onClick={handleAuthenticate}
                    isLoading={isPending}
                    disabled={isPending}
                >
                    {isPending && <Spinner />} Authenticate
                </Button>
            </Panel>
        </div>
    );
}
