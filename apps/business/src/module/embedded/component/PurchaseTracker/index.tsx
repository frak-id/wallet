import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { CallOut } from "@/module/common/component/CallOut";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useOracleSetupData } from "@/module/merchant/hook/useOracleSetupData";
import styles from "../Mint/index.module.css";

export function EmbeddedPurchaseTracker() {
    const search = useSearch({ from: "/embedded/_layout/purchase-tracker" });

    const { merchantId, productId, platform, secret } = useMemo(() => {
        const merchantId = search.mid;
        const productId = search.pid;

        // Default to shopify values
        const platform = search.p ?? "internal";
        const secret = search.s ?? "SHOPIFY_SECRET";

        // Validate platform
        if (
            !["internal", "custom", "shopify", "woocommerce"].includes(platform)
        ) {
            throw new Error("Invalid platform");
        }

        if (!merchantId) {
            throw new Error("Missing required parameter: merchantId (mid)");
        }

        return {
            merchantId,
            productId: productId as Hex | undefined,
            platform: platform as
                | "internal"
                | "custom"
                | "shopify"
                | "woocommerce",
            secret,
        };
    }, [search]);

    const {
        mutate: setupPurchaseTracker,
        isPending,
        isSuccess,
        isError,
    } = usePurchaseTrackerSetup({
        merchantId,
        productId,
        platform,
        secret,
    });

    useEffect(() => {
        if (!merchantId) return;
        setupPurchaseTracker();
    }, [setupPurchaseTracker, merchantId]);

    // Button to exit
    const close = useCallback(() => {
        // Close the current window
        window.close();
    }, []);

    return (
        <>
            <Title className={styles.title}>
                Register your Purchase Tracker
            </Title>
            <Panel withBadge={false}>
                {isPending && (
                    <CallOut variant="primary">
                        <p className={styles.spinner}>
                            <Spinner />
                            Registering Purchase Tracker...
                        </p>
                    </CallOut>
                )}
                {isError && (
                    <CallOut variant="danger">
                        Can't register your purchase tracker. Double check that
                        everything is right.
                    </CallOut>
                )}
                {isSuccess && (
                    <CallOut variant="success">
                        Purchase tracker registered successfully
                    </CallOut>
                )}
                {(isSuccess || isError) && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={styles.button}
                        onClick={close}
                    >
                        Close
                    </Button>
                )}
            </Panel>
        </>
    );
}

function usePurchaseTrackerSetup({
    merchantId,
    productId,
    platform,
    secret,
}: {
    merchantId: string;
    productId?: Hex;
    platform: "internal" | "custom" | "shopify" | "woocommerce";
    secret: string;
}) {
    const { refetch } = useOracleSetupData({ merchantId, productId });
    return useMutation({
        mutationKey: [
            "merchant",
            merchantId,
            "oracle-webhook-internal",
            "setup",
        ],
        mutationFn: async () => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.post({
                    hookSignatureKey: secret,
                    platform,
                });
            if (error) {
                console.error(error);
                throw error;
            }
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
