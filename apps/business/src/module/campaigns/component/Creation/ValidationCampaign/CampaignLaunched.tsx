import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BellIcon,
    CheckIcon,
    NumberBadgeIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { campaignStore } from "@/stores/campaignStore";
import * as styles from "./campaign-launched.css";

// No in-app best-practices page yet — points at the docs (TBD with content).
const BEST_PRACTICES_URL = "https://docs.frak.id";

const TIPS = [
    {
        titleKey: "campaigns.create.success.tip1Title",
        descKey: "campaigns.create.success.tip1Desc",
    },
    {
        titleKey: "campaigns.create.success.tip2Title",
        descKey: "campaigns.create.success.tip2Desc",
    },
    {
        titleKey: "campaigns.create.success.tip3Title",
        descKey: "campaigns.create.success.tip3Desc",
    },
] as const;

export function CampaignLaunched() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const reset = campaignStore((s) => s.reset);
    const { data: merchant } = useMerchant({ merchantId });

    const campaignId = draft.id;

    function goToList() {
        reset();
        navigate({
            to: "/m/$merchantId/campaigns/list",
            params: { merchantId },
        });
    }

    function goToPerformance() {
        reset();
        if (!campaignId) {
            goToList();
            return;
        }
        navigate({
            to: "/m/$merchantId/campaigns/$campaignId",
            params: { merchantId, campaignId },
        });
    }

    return (
        <div className={styles.root}>
            <div className={styles.main}>
                <div className={styles.inner}>
                    <Stack space="l">
                        <Stack space="m" align="center">
                            <div className={styles.checkCircle}>
                                <CheckIcon width={24} height={24} />
                            </div>
                            <Stack space="m" align="center">
                                <Text variant="heading2" align="center">
                                    {t("campaigns.create.success.title")}
                                </Text>
                                <Text
                                    variant="body"
                                    color="secondary"
                                    align="center"
                                >
                                    {t("campaigns.create.success.subtitle", {
                                        name: draft.name,
                                    })}
                                </Text>
                            </Stack>
                        </Stack>

                        <Card radius="l" variant="elevated" padding="default">
                            <Inline space="m" alignY="top" wrap={false}>
                                <div className={styles.bellCircle}>
                                    <BellIcon width={24} height={24} />
                                </div>
                                <Stack space="xxs" className={styles.grow}>
                                    <Text variant="body" weight="medium">
                                        {t(
                                            "campaigns.create.success.notifyTitle"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "campaigns.create.success.notifyBody",
                                            { merchant: merchant?.name ?? "" }
                                        )}
                                    </Text>
                                </Stack>
                            </Inline>
                        </Card>

                        <Card radius="m" variant="elevated" padding="none">
                            <Box paddingTop="m" paddingBottom="l" paddingX="m">
                                <Stack space="m">
                                    <Stack space="xxs">
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                            color="secondary"
                                        >
                                            {t(
                                                "campaigns.create.success.tipsTitle"
                                            )}
                                        </Text>
                                        <Text
                                            variant="caption"
                                            color="tertiary"
                                        >
                                            {t(
                                                "campaigns.create.success.tipsSubtitle"
                                            )}
                                        </Text>
                                    </Stack>

                                    <Stack space="none">
                                        {TIPS.map((tip, index) => (
                                            <Inline
                                                key={tip.titleKey}
                                                space="m"
                                                alignY="top"
                                                paddingX="m"
                                                paddingY="s"
                                                wrap={false}
                                            >
                                                <NumberBadgeIcon
                                                    value={
                                                        (index + 1) as 1 | 2 | 3
                                                    }
                                                    width={24}
                                                    height={24}
                                                />
                                                <Stack
                                                    space="xxs"
                                                    className={styles.grow}
                                                >
                                                    <Text
                                                        variant="body"
                                                        weight="medium"
                                                    >
                                                        {t(tip.titleKey)}
                                                    </Text>
                                                    <Text
                                                        variant="bodySmall"
                                                        color="secondary"
                                                    >
                                                        {t(tip.descKey)}
                                                    </Text>
                                                </Stack>
                                            </Inline>
                                        ))}
                                    </Stack>

                                    <Inline space="none">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="small"
                                            onClick={() =>
                                                window.open(
                                                    BEST_PRACTICES_URL,
                                                    "_blank",
                                                    "noopener,noreferrer"
                                                )
                                            }
                                        >
                                            {t(
                                                "campaigns.create.success.bestPractices"
                                            )}
                                        </Button>
                                    </Inline>
                                </Stack>
                            </Box>
                        </Card>
                    </Stack>
                </div>
            </div>

            <div className={styles.bottomBar}>
                <Button
                    type="button"
                    variant="secondary"
                    size="large"
                    onClick={goToList}
                >
                    {t("campaigns.create.success.viewAllCampaigns")}
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    onClick={goToPerformance}
                >
                    {t("campaigns.create.success.viewPerformance")}
                </Button>
            </div>
        </div>
    );
}
