"use client";

import { CallOut } from "@/module/common/component/CallOut";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useOracleSetupData } from "@/module/product/hook/useOracleSetupData";
import { businessApi } from "@frak-labs/client/server";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import type { Hex } from "viem";
import styles from "../Mint/index.module.css";

export function EmbeddedPurchaseTracker() {
    const searchParams = useSearchParams();

    const { productId, platform, secret } = useMemo(() => {
        const productId = searchParams?.get("pid");

        // Default to shopify values
        const platform = searchParams?.get("p") ?? "internal";
        const secret = searchParams?.get("s") ?? "SHOPIFY_SECRET";

        // Validate platform
        if (
            !["internal", "custom", "shopify", "woocommerce"].includes(platform)
        ) {
            throw new Error("Invalid platform");
        }

        if (!productId) {
            throw new Error("Missing required parameters");
        }

        return {
            productId,
            platform: platform as
                | "internal"
                | "custom"
                | "shopify"
                | "woocommerce",
            secret,
        };
    }, [searchParams]);

    const {
        mutate: setupPurchaseTracker,
        isPending,
        isSuccess,
        isError,
    } = usePurchaseTrackerSetup({
        productId: productId as Hex,
        platform,
        secret,
    });

    useEffect(() => {
        if (!productId) return;
        setupPurchaseTracker();
    }, [setupPurchaseTracker, productId]);

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
    productId,
    platform,
    secret,
}: {
    productId: Hex;
    platform: "internal" | "custom" | "shopify" | "woocommerce";
    secret: string;
}) {
    const { refetch } = useOracleSetupData({ productId });
    return useMutation({
        mutationKey: ["product", "oracle-webhook-internal", "setup", productId],
        mutationFn: async () => {
            const { error } = await businessApi
                .product({ productId })
                .oracleWebhook.setup.post({
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
