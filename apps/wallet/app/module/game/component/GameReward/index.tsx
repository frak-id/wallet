import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RedeemResult } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { frakGame } from "@/module/game/config";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { MerchantLogo } from "@/module/history/component/MerchantLogo";
import * as styles from "./index.css";

type GameRewardProps = {
    onContinue: () => void;
    /** EURe the redemption earned, still locked; 0 shows the join alone. */
    reward: number;
    /** The game joined; absent for a friend's code with no open game. */
    game?: RedeemResult["game"];
};

function rewardDescriptionKey(reward: number) {
    if (reward <= 0) return "onboarding.game.reward.descriptionJoinOnly";
    return frakGame.instagramLink
        ? "onboarding.game.reward.descriptionFollow"
        : "onboarding.game.reward.description";
}

export function GameReward({ onContinue, reward, game }: GameRewardProps) {
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
                {reward > 0 && (
                    <Text variant="display1" as="p" className={styles.amount}>
                        {formatGameAmount(reward, i18n.language)}
                    </Text>
                )}
                <Box display="flex" flexDirection="column" gap="s">
                    <Text variant="heading1" as="h2" align="center">
                        {t("onboarding.game.reward.title")}
                    </Text>
                    <Text color="secondary" align="center">
                        {t(rewardDescriptionKey(reward))}
                    </Text>
                </Box>
                {game && <JoinedGameCard game={game} />}
            </div>
        </PageLayout>
    );
}

function JoinedGameCard({ game }: { game: NonNullable<RedeemResult["game"]> }) {
    const { t, i18n } = useTranslation();
    const endsAt = new Date(game.endsAt).toLocaleString(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Card variant="muted" className={styles.gameCard}>
            <Text variant="bodySmall" color="secondary">
                {t("onboarding.game.reward.game.label")}
            </Text>
            <Text weight="semiBold">
                {game.prizeDescription ??
                    formatGameAmount(game.prizeAmount, i18n.language)}
            </Text>
            <Text variant="bodySmall" color="secondary">
                {t("onboarding.game.reward.game.endsAt", { date: endsAt })}
            </Text>
            {game.sponsor && (
                <Inline space="xs" align="center" alignY="center">
                    <MerchantLogo merchant={game.sponsor} />
                    <Text variant="bodySmall" color="secondary">
                        {t("onboarding.game.reward.game.sponsor", {
                            name: game.sponsor.name,
                        })}
                    </Text>
                </Inline>
            )}
        </Card>
    );
}
