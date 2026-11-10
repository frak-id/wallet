import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ShareIcon } from "@frak-labs/design-system/icons";
import { merchant } from "@/data/merchant";
import { campaign } from "@/data/rewards";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { walletMessages } from "../../messages";

/** The referee is invited to start referring in turn. */
export function ShareNudge() {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    return (
        <Card>
            <Stack space="m">
                <Inline space="s" alignY="top" wrap={false}>
                    <IconCircle size="md" tone="action">
                        <ShareIcon width={20} height={20} />
                    </IconCircle>
                    <Stack space="xxs">
                        <Text variant="body" weight="semiBold">
                            {t("nudge.turn.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("nudge.turn.description", {
                                amount: money(
                                    campaign.referrerReward,
                                    "reward"
                                ),
                                merchant: merchant.name,
                            })}
                        </Text>
                    </Stack>
                </Inline>
                <Button variant="secondary" size="small">
                    {t("nudge.turn.cta")}
                </Button>
            </Stack>
        </Card>
    );
}
