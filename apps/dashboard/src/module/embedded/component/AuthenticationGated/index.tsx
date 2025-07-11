"use client";

import { getSession, setSession } from "@/context/auth/actions/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useSiweAuthenticate, useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import styles from "../Mint/index.module.css";

/**
 * Simple wrapper to ensure that the child component is only rendered when user is authenticated
 */
export function AuthenticationGated({
    children,
    action,
}: { action: string; children: ReactNode }) {
    const {
        data: walletStatus,
        refetch: refetchWalletStatus,
        isLoading: isLoadingWalletStatus,
    } = useWalletStatus();
    const {
        data: session,
        refetch: refetchSession,
        isLoading: isLoadingSession,
    } = useQuery({
        queryKey: ["session"],
        queryFn: async () => getSession(),
    });

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Register the session
                await setSession(data);

                // Refresh the wallet status and session
                await Promise.allSettled([
                    refetchWalletStatus(),
                    refetchSession(),
                ]);
            },
        },
    });

    const isAuthenticated = useMemo(() => {
        return walletStatus?.key === "connected" && session;
    }, [walletStatus, session]);

    const isLoading = useMemo(() => {
        return isLoadingWalletStatus || isLoadingSession || isPending;
    }, [isLoadingWalletStatus, isLoadingSession, isPending]);

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
