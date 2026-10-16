import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { frakGame } from "@/module/game/config";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import * as styles from "./index.css";

type GameRewardProps = {
    onContinue: () => void;
};

export function GameReward({ onContinue }: GameRewardProps) {
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
                    {formatGameAmount(frakGame.rewardEur, i18n.language)}
                </Text>
                <Box display="flex" flexDirection="column" gap="s">
                    <Text variant="heading1" as="h2" align="center">
                        {t("onboarding.game.reward.title")}
                    </Text>
                    <Text color="secondary" align="center">
                        {t("onboarding.game.reward.description")}
                    </Text>
                </Box>
            </div>
        </PageLayout>
    );
}
