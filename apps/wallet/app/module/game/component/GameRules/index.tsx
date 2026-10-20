import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { ExternalLink, type RedeemResult } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { Trans, useTranslation } from "react-i18next";
import { InstructionList } from "@/module/common/component/InstructionList";
import { PageLayout } from "@/module/common/component/PageLayout";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import * as stepStyles from "@/module/onboarding/component/step/index.css";
import * as styles from "./index.css";

const FRAK_INSTAGRAM_URL = "https://www.instagram.com/frak_fr/";

type InviteRewards = NonNullable<RedeemResult["inviteRewards"]>;

type GameRulesProps = {
    onContinue: () => void;
    /** EURe the redemption earned, still locked. */
    reward: number;
    /** Absent when no signup reward is live. */
    invite?: InviteRewards;
};

function inviteDescription(
    t: DefaultTranslate,
    locale: string,
    invite: InviteRewards | undefined
): string {
    const points = t("onboarding.game.rules.invite.description");
    if (!invite) return points;
    const amounts =
        invite.referrer === invite.referee
            ? t("onboarding.game.rules.invite.reward", {
                  reward: formatGameAmount(invite.referrer, locale),
              })
            : t("onboarding.game.rules.invite.rewardSplit", {
                  referrer: formatGameAmount(invite.referrer, locale),
                  referee: formatGameAmount(invite.referee, locale),
              });
    return `${amounts} ${points}`;
}

export function GameRules({ onContinue, reward, invite }: GameRulesProps) {
    const { t, i18n } = useTranslation();

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
                            title: t("onboarding.game.rules.unlock.title", {
                                reward: formatGameAmount(reward, i18n.language),
                            }),
                            description: t(
                                "onboarding.game.rules.unlock.description"
                            ),
                        },
                        {
                            title: t("onboarding.game.rules.invite.title"),
                            description: inviteDescription(
                                t,
                                i18n.language,
                                invite
                            ),
                        },
                        {
                            title: t("onboarding.game.rules.follow.title"),
                            description: (
                                <Trans
                                    i18nKey="onboarding.game.rules.follow.description"
                                    components={{
                                        igLink: (
                                            <ExternalLink
                                                href={FRAK_INSTAGRAM_URL}
                                                className={styles.link}
                                            />
                                        ),
                                    }}
                                />
                            ),
                        },
                    ]}
                />
            </div>
        </PageLayout>
    );
}
