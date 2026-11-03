import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { GiftIcon } from "@frak-labs/design-system/icons";
import { ExternalLink, type RedeemResult } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { Trans, useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { GameTaskRow } from "@/module/game/component/GameTaskRow";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { ICONS, rewardOf } from "@/module/game/utils/gameMissionDisplay";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
import * as styles from "./index.css";

type InviteRewards = NonNullable<RedeemResult["inviteRewards"]>;

type GameRulesProps = {
    onContinue: () => void;
    /** EURe the redemption earned, still locked; 0 drops the unlock row. */
    reward: number;
    /** Absent when no signup reward is live. */
    invite?: InviteRewards;
};

function inviteDescription(
    t: DefaultTranslate,
    locale: string,
    invite: InviteRewards | undefined
): string {
    const tickets = t("onboarding.game.rules.invite.description");
    if (!invite) return tickets;
    const amounts =
        invite.referrer === invite.referee
            ? t("onboarding.game.rules.invite.reward", {
                  reward: formatGameAmount(invite.referrer, locale),
              })
            : t("onboarding.game.rules.invite.rewardSplit", {
                  referrer: formatGameAmount(invite.referrer, locale),
                  referee: formatGameAmount(invite.referee, locale),
              });
    return `${amounts} ${tickets}`;
}

const iconProps = { width: 18, height: 18 } as const;

/** The ways to earn tickets, laid out like the game page's missions. */
export function GameRules({ onContinue, reward, invite }: GameRulesProps) {
    const { t, i18n } = useTranslation();
    const { instagram: Instagram, friend: Friend, purchase: Purchase } = ICONS;

    return (
        <PageLayout
            fixedViewport
            footer={
                <Button onClick={onContinue}>{t("onboarding.continue")}</Button>
            }
        >
            <Stack space="m" className={styles.body}>
                <Stack space="s">
                    <Text variant="heading1" as="h2" align="center">
                        {t("onboarding.game.rules.title")}
                    </Text>
                    <Text color="secondary" align="center">
                        {t("onboarding.game.rules.description")}
                    </Text>
                </Stack>
                <Stack space="xs">
                    <Text weight="semiBold">
                        {t("onboarding.game.rules.howItWorks")}
                    </Text>
                    <Card variant="muted" padding="none">
                        {reward > 0 && (
                            <GameTaskRow
                                icon={<GiftIcon {...iconProps} />}
                                tone="action"
                                stacked
                                title={t("onboarding.game.bonus.title", {
                                    reward: formatGameAmount(
                                        reward,
                                        i18n.language
                                    ),
                                })}
                                hint={t("onboarding.game.bonus.description")}
                                badge={{
                                    variant: "warning",
                                    label: t("onboarding.game.bonus.pending"),
                                }}
                            />
                        )}
                        <GameTaskRow
                            icon={<Instagram {...iconProps} />}
                            tone="action"
                            stacked
                            title={t("onboarding.game.rules.follow.title")}
                            hint={
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
                            }
                            badge={{
                                variant: "info",
                                label: rewardOf(t, "instagram"),
                            }}
                        />
                        <GameTaskRow
                            icon={<Friend {...iconProps} />}
                            tone="action"
                            stacked
                            title={t("onboarding.game.rules.invite.title")}
                            hint={inviteDescription(t, i18n.language, invite)}
                            badge={{
                                variant: "info",
                                label: rewardOf(t, "friend"),
                            }}
                        />
                        <GameTaskRow
                            icon={<Purchase {...iconProps} />}
                            tone="action"
                            stacked
                            title={t("onboarding.game.rules.purchase.title")}
                            hint={t(
                                "onboarding.game.rules.purchase.description"
                            )}
                            badge={{
                                variant: "info",
                                label: rewardOf(t, "purchase"),
                            }}
                        />
                    </Card>
                </Stack>
            </Stack>
        </PageLayout>
    );
}
