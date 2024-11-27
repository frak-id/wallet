import { useDisplayModal, useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { useLoaderData } from "@remix-run/react";
import {
    BlockStack,
    Button,
    InlineStack,
    Spinner,
    Text,
} from "@shopify/polaris";
import type { loader } from "app/routes/app._index";
import { type ReactNode, useCallback } from "react";

export function WalletGated({ children }: { children: ReactNode }) {
    return (
        <BlockStack gap="200">
            <WalletGatedInner>{children}</WalletGatedInner>
        </BlockStack>
    );
}

function WalletGatedInner({ children }: { children: ReactNode }) {
    const {
        shop: { url },
    } = useLoaderData<typeof loader>();
    const { data: walletStatus } = useWalletStatus();
    const { mutate: displayFrakModal, isPending } = useDisplayModal();

    const authenticate = useCallback(() => {
        displayFrakModal({
            steps: {
                login: {
                    allowSso: true,
                    ssoMetadata: {
                        homepageLink: url,
                    },
                },
            },
        });
    }, [displayFrakModal, url]);

    if (walletStatus === undefined) {
        return (
            <InlineStack gap="200" blockAlign="center">
                <Spinner size="small" />
                <Text variant="headingMd" as="h2">
                    Checking everything...
                </Text>
            </InlineStack>
        );
    }

    if (!walletStatus.wallet) {
        return (
            <>
                <Text as="h2" variant="headingMd">
                    Please connect to a Frak wallet to administrate your store.
                </Text>
                <InlineStack align="space-between">
                    <Button loading={isPending} onClick={authenticate}>
                        Connect Wallet
                    </Button>
                </InlineStack>
            </>
        );
    }

    return <>{children}</>;
}
