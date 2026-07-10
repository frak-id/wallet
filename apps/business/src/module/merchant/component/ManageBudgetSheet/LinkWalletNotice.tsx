import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { useLinkWallet } from "@/module/auth/hooks/useLinkWallet";

/**
 * Walletless-owner CTA (§4.9): shown wherever an onchain bank action (bank
 * open/close, allowance, withdraw, legacy migration) would otherwise render
 * — the explicit path out of the read-only state.
 */
export function LinkWalletNotice() {
    const { t } = useTranslation();
    const { mutate: linkWallet, isPending, error } = useLinkWallet();

    return (
        <Card radius="m">
            <Stack space="xs">
                <Text variant="body" weight="medium">
                    {t("funding.linkWallet.title")}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t("funding.linkWallet.description")}
                </Text>
                <Button
                    size="large"
                    width="auto"
                    loading={isPending}
                    disabled={isPending}
                    onClick={() => linkWallet()}
                >
                    {t("funding.linkWallet.cta")}
                </Button>
                {error && (
                    <Text variant="bodySmall" color="error">
                        {error.message}
                    </Text>
                )}
            </Stack>
        </Card>
    );
}
