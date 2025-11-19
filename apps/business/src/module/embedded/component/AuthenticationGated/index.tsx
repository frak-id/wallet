import { useSiweAuthenticate, useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { type ReactNode, useMemo } from "react";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAuthStore } from "@/stores/authStore";
import styles from "../Mint/index.module.css";

/**
 * Simple wrapper to ensure that the child component is only rendered when user is authenticated
 */
export function AuthenticationGated({
    children,
    action,
}: {
    action: string;
    children: ReactNode;
}) {
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
            },
        },
    });

    const isAuthenticated = useMemo(() => {
        return walletStatus?.key === "connected" && isAuthenticatedInStore;
    }, [walletStatus, isAuthenticatedInStore]);

    const isLoading = useMemo(() => {
        return isLoadingWalletStatus || isPending;
    }, [isLoadingWalletStatus, isPending]);

    if (isLoading || walletStatus === undefined) {
        return (
            <div>
                <Spinner />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                <Title className={styles.title}>Authentication required</Title>
                <Panel
                    withBadge={false}
                    title={`Please connect your wallet to ${action}`}
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
            </>
        );
    }

    return <>{children}</>;
}
