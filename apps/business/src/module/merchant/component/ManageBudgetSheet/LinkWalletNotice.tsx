import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import {
    linkWalletErrorMessage,
    useLinkWallet,
} from "@/module/auth/hooks/useLinkWallet";

/**
 * Optional, secondary card for accounts without a linked wallet. Rendered
 * below the budget so it never competes with "Add funds"; it is also the
 * fallback wherever an on-chain bank action would otherwise appear.
 */
export function LinkWalletNotice() {
    const { t } = useTranslation();
    const { mutate: linkWallet, isPending, error } = useLinkWallet();
    const errorMessage = linkWalletErrorMessage(error, t);

    return (
        <Card variant="muted" radius="m" padding="compact">
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium">
                    {t("funding.linkWallet.title")}
                </Text>
                <Text variant="caption" color="secondary">
                    {t("funding.linkWallet.description")}
                </Text>
                <Button
                    variant="secondary"
                    size="small"
                    width="auto"
                    loading={isPending}
                    disabled={isPending}
                    onClick={() => linkWallet()}
                >
                    {t("funding.linkWallet.cta")}
                </Button>
                {errorMessage && (
                    <Notice tone="error" role="alert">
                        {errorMessage}
                    </Notice>
                )}
            </Stack>
        </Card>
    );
}
