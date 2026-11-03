import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, GiftIcon } from "@frak-labs/design-system/icons";
import type { RedeemResult } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import {
    DeckBadge,
    GainBadge,
    HeroCard,
    HeroChip,
    HeroEndsAt,
    TicketDeck,
} from "@/module/game/component/GameHero";
import { GameTaskRow } from "@/module/game/component/GameTaskRow";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { prizeToWinOf } from "@/module/game/utils/gamePrize";
import { TICKET_AMOUNTS } from "@/module/game/utils/ticketAmounts";
import { MerchantLogo } from "@/module/history/component/MerchantLogo";
import * as styles from "./index.css";

type JoinedGame = NonNullable<RedeemResult["game"]>;

type GameRewardProps = {
    onContinue: () => void;
    /** EURe the redemption earned, still locked; 0 shows the join alone. */
    reward: number;
    /** The game joined; absent for a friend's code with no open game. */
    game?: JoinedGame;
};

/** The first ticket landing on the deck, with the prize and the time left. */
function JoinedHero({ game }: { game: JoinedGame }) {
    const { t, i18n } = useTranslation();

    return (
        <HeroCard>
            <TicketDeck face={TICKET_AMOUNTS.join} front={{ pop: true }}>
                <GainBadge count={TICKET_AMOUNTS.join} />
            </TicketDeck>
            <Text variant="heading3" color="onAction" as="h2">
                {t("onboarding.game.reward.title")}
            </Text>
            <HeroChip
                tone="success"
                icon={<CheckIcon width={14} height={14} aria-hidden="true" />}
            >
                {t("game.join.firstTicket")}
            </HeroChip>
            <Text color="onAction" as="p">
                {prizeToWinOf(t, game, i18n.language)}
            </Text>
            <HeroEndsAt endsAt={game.endsAt} />
            {game.sponsor && (
                <Inline space="xs" align="center" alignY="center">
                    <MerchantLogo merchant={game.sponsor} />
                    <Text variant="caption" color="onAction">
                        {t("onboarding.game.reward.game.sponsor", {
                            name: game.sponsor.name,
                        })}
                    </Text>
                </Inline>
            )}
        </HeroCard>
    );
}

/** A friend's code with no game open: the bonus is the news. */
function BonusHero({ amount }: { amount: string }) {
    const { t } = useTranslation();

    return (
        <HeroCard>
            <TicketDeck face={amount} front={{ prize: true, pop: true }}>
                <DeckBadge icon={GiftIcon} />
            </TicketDeck>
            <Text variant="heading3" color="onAction" as="h2">
                {t("onboarding.game.reward.title")}
            </Text>
            <Text color="onAction" as="p">
                {t("onboarding.game.reward.description")}
            </Text>
        </HeroCard>
    );
}

export function GameReward({ onContinue, reward, game }: GameRewardProps) {
    const { t, i18n } = useTranslation();
    useConfettiBurst();
    const amount = formatGameAmount(reward, i18n.language);

    return (
        <PageLayout
            fixedViewport
            footer={
                <Button onClick={onContinue}>{t("onboarding.continue")}</Button>
            }
        >
            <Stack space="m" justify="center" className={styles.body}>
                {game ? (
                    <JoinedHero game={game} />
                ) : (
                    <BonusHero amount={amount} />
                )}
                {game && reward > 0 && (
                    <Card variant="muted" padding="none">
                        <GameTaskRow
                            icon={<GiftIcon width={18} height={18} />}
                            tone="action"
                            stacked
                            title={t("onboarding.game.bonus.title", {
                                reward: amount,
                            })}
                            hint={t("onboarding.game.bonus.description")}
                            badge={{
                                variant: "warning",
                                label: t("onboarding.game.bonus.pending"),
                            }}
                        />
                    </Card>
                )}
                {game && reward === 0 && (
                    <Text color="secondary" align="center">
                        {t("onboarding.game.reward.descriptionJoinOnly")}
                    </Text>
                )}
            </Stack>
        </PageLayout>
    );
}
