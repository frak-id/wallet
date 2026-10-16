import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { InstructionList } from "@/module/common/component/InstructionList";
import { PageLayout } from "@/module/common/component/PageLayout";
import { frakGame } from "@/module/game/config";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import * as stepStyles from "@/module/onboarding/component/step/index.css";
import * as styles from "./index.css";

type GameRulesProps = {
    onContinue: () => void;
};

export function GameRules({ onContinue }: GameRulesProps) {
    const { t, i18n } = useTranslation();
    const values = {
        reward: formatGameAmount(frakGame.rewardEur, i18n.language),
        prize: formatGameAmount(frakGame.prizeEur, i18n.language),
    };

    return (
        <PageLayout
            fixedViewport
            footer={
                <Button onClick={onContinue}>{t("onboarding.continue")}</Button>
            }
        >
            <div className={`${stepStyles.body} ${styles.body}`}>
                <Box display="flex" flexDirection="column" gap="s">
                    <Text variant="heading1" as="h2" align="center">
                        {t("onboarding.game.rules.title")}
                    </Text>
                    <Text color="secondary" align="center">
                        {t("onboarding.game.rules.description")}
                    </Text>
                </Box>
                <InstructionList
                    title={t("onboarding.game.rules.howItWorks")}
                    steps={[
                        {
                            title: t(
                                "onboarding.game.rules.unlock.title",
                                values
                            ),
                            description: t(
                                "onboarding.game.rules.unlock.description"
                            ),
                        },
                        {
                            title: t("onboarding.game.rules.invite.title"),
                            description: t(
                                "onboarding.game.rules.invite.description",
                                values
                            ),
                        },
                        {
                            title: t("onboarding.game.rules.follow.title"),
                            description: t(
                                "onboarding.game.rules.follow.description",
                                values
                            ),
                        },
                    ]}
                />
            </div>
        </PageLayout>
    );
}
