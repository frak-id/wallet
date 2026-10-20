import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RedeemResult } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { MerchantLogo } from "@/module/history/component/MerchantLogo";
import * as styles from "./index.css";

type GameRewardProps = {
    onContinue: () => void;
    /** EURe the redemption earned, still locked. */
    reward: number;
    /** The drop joined; absent for a friend's code with no open drop. */
    drop?: RedeemResult["drop"];
};

export function GameReward({ onContinue, reward, drop }: GameRewardProps) {
    const { t, i18n } = useTranslation();
    useConfettiBurst();

    return (
        <PageLayout
            fixedViewport
            footer={
                <Button onClick={onContinue}>{t("onboarding.continue")}</Button>
            }
        >
            <div className={styles.body}>
                <Text variant="display1" as="p" className={styles.amount}>
                    {formatGameAmount(reward, i18n.language)}
                </Text>
                <Box display="flex" flexDirection="column" gap="s">
                    <Text variant="heading1" as="h2" align="center">
                        {t("onboarding.game.reward.title")}
                    </Text>
                    <Text color="secondary" align="center">
                        {t("onboarding.game.reward.description")}
                    </Text>
                </Box>
                {drop && <DropCard drop={drop} />}
            </div>
        </PageLayout>
    );
}

function DropCard({ drop }: { drop: NonNullable<RedeemResult["drop"]> }) {
    const { t, i18n } = useTranslation();
    const endsAt = new Date(drop.endsAt).toLocaleString(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Card variant="muted" className={styles.dropCard}>
            <Text variant="bodySmall" color="secondary">
                {t("onboarding.game.reward.drop.label")}
            </Text>
            <Text weight="semiBold">{drop.prizeDescription}</Text>
            <Text variant="bodySmall" color="secondary">
                {t("onboarding.game.reward.drop.endsAt", { date: endsAt })}
            </Text>
            {drop.sponsor && (
                <Inline space="xs" align="center" alignY="center">
                    <MerchantLogo merchant={drop.sponsor} />
                    <Text variant="bodySmall" color="secondary">
                        {t("onboarding.game.reward.drop.sponsor", {
                            name: drop.sponsor.name,
                        })}
                    </Text>
                </Inline>
            )}
        </Card>
    );
}
