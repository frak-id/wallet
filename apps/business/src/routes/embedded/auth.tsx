import { useSiweAuthenticate, useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
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

    const {
        data: walletStatus,
        refetch: refetchWalletStatus,
        isLoading: isLoadingWalletStatus,
    } = useWalletStatus();

    const isAuthenticatedInStore = useAuthStore((state) =>
        state.isAuthenticated()
    );

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Call backend to exchange SIWE for JWT
                const response = await authenticatedBackendApi.auth.login.post({
                    message: data.message,
                    signature: data.signature,
                });

                if (response.error) {
                    console.error("Login failed:", response.error);
                    return;
                }

                // Store token in Zustand
                useAuthStore
                    .getState()
                    .setAuth(
                        response.data.token,
                        response.data.wallet,
                        response.data.expiresAt
                    );

                // Refresh the wallet status
                await refetchWalletStatus();

                // Redirect to original destination
                navigate({ to: redirect });
            },
        },
    });

    const isAuthenticated = useMemo(() => {
        return walletStatus?.key === "connected" && isAuthenticatedInStore;
    }, [walletStatus, isAuthenticatedInStore]);

    const isLoading = useMemo(() => {
        return isLoadingWalletStatus || isPending;
    }, [isLoadingWalletStatus, isPending]);

    // If already authenticated, redirect immediately
    if (isAuthenticated) {
        navigate({ to: redirect });
        return null;
    }

    if (isLoading || walletStatus === undefined) {
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
                    onClick={() =>
                        authenticate({
                            siwe: {
                                // Expire the session after 1 week
                                expirationTimeTimestamp:
                                    Date.now() + 1000 * 60 * 60 * 24 * 7,
                            },
                        })
                    }
                    isLoading={isPending}
                    disabled={isPending}
                >
                    {isPending && <Spinner />} Authenticate
                </Button>
            </Panel>
        </div>
    );
}
