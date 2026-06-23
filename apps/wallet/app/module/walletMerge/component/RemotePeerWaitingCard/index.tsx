import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

/**
 * Shared "we sent the request to your other device" indicator.
 *
 * Used by every merge step that fires a signature-request through the
 * origin pairing (consent remote, sign when desktop=loser, migrate when
 * desktop=winner). Mirrors the listener's `OriginPairingState` cue, but
 * styled as a wallet design-system muted card so it blends with the rest
 * of the merge flow.
 *
 * Renderless on its own — callers gate display on
 * `mutation.isPending && transport === "paired"`.
 */
export function RemotePeerWaitingCard() {
    const { t } = useTranslation();

    return (
        <Card
            variant="muted"
            padding="default"
            role="status"
            aria-live="polite"
        >
            <Inline space="m" alignY="center" wrap={false}>
                <Box display="flex" alignItems="center" flexShrink={0}>
                    <Spinner />
                </Box>
                <Stack space="xxs">
                    <Text variant="body" weight="semiBold">
                        {t("wallet.merge.peerWaiting.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("wallet.merge.peerWaiting.description")}
                    </Text>
                </Stack>
            </Inline>
        </Card>
    );
}
