import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { GiftIcon, InstagramIcon } from "@frak-labs/design-system/icons";
import { type RedeemResult, trackEvent } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import {
    DeckBadge,
    HeroCard,
    HeroChip,
    HeroEndsAt,
    TicketDeck,
} from "@/module/game/component/GameHero";
import { PastGames } from "@/module/game/component/GameResult";
import { GameReward } from "@/module/game/component/GameReward";
import {
    currentGameKeys,
    useCurrentGame,
} from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { prizeToWinOf } from "@/module/game/utils/gamePrize";
import { gameRewardOf } from "@/module/game/utils/gameRewardOf";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
import { RedeemForm } from "@/module/referral/component/RedeemReferralCodePage";

type OpenGame = NonNullable<CurrentGameResponse["game"]>;

/** The open game before joining: a blank ticket on the hero deck, the prize and the time left. */
function JoinHero({ game }: { game: OpenGame }) {
    const { t, i18n } = useTranslation();

    return (
        <HeroCard>
            <TicketDeck face="?" cards={{ locked: true }} front={{ pop: true }}>
                <DeckBadge icon={GiftIcon} />
            </TicketDeck>
            <Text variant="heading3" color="onAction" as="p">
                {t("game.join.hero.title")}
            </Text>
            <HeroChip tone="info">{t("game.join.firstTicket")}</HeroChip>
            <Text color="onAction" as="p">
                {prizeToWinOf(t, game, i18n.language)}
            </Text>
            <HeroEndsAt endsAt={game.endsAt} />
        </HeroCard>
    );
}

export function JoinGamePage({ initialCode }: { initialCode?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const current = useCurrentGame();
    const history = useGameHistory();
    const [joined, setJoined] = useState<RedeemResult | null>(null);
    // A shared friend's code lands here too, from a player already in the game.
    const openGame =
        current.data?.game && !current.data.me.participating
            ? current.data.game
            : null;

    useEffect(() => {
        trackEvent("game_code_entry_viewed", { prefilled: !!initialCode });
    }, [initialCode]);

    const handleRedeemed = async (result: RedeemResult) => {
        trackEvent("game_code_submitted", {
            outcome: result.game ? "joined" : "referrer_set",
        });
        if (result.game) {
            // Refetch, not invalidate: nothing observes the query here, and /game bounces back on a stale non-participant.
            const refetched = queryClient.refetchQueries({
                queryKey: currentGameKeys.all,
            });
            if (gameRewardOf(result) > 0) {
                setJoined(result);
                return;
            }
            await refetched;
            navigate({ to: "/game", replace: true });
            return;
        }
        // A friend's code became the referrer: the referral page shows it as before.
        navigate({ to: "/profile/referral/redeem", replace: true });
    };

    if (joined) {
        return (
            <GameReward
                reward={gameRewardOf(joined)}
                game={joined.game}
                onContinue={() => navigate({ to: "/game", replace: true })}
            />
        );
    }

    return (
        <Stack space="m">
            <Back href="/wallet" />
            <Title size="page">{t("game.join.title")}</Title>
            {current.isLoading && <Skeleton variant="rect" height={160} />}
            {openGame && <JoinHero game={openGame} />}
            <Text variant="body" color="secondary">
                {t("game.join.description")}
            </Text>
            <RedeemForm
                onRedeemed={handleRedeemed}
                onError={(errorKey) =>
                    trackEvent("game_code_submitted", {
                        outcome: "error",
                        error_key: errorKey,
                    })
                }
                initialCode={initialCode}
                label={t("game.join.label")}
                submitLabel={t("game.join.submit")}
            />
            <InfoCard>
                <InfoRow
                    icon={InstagramIcon}
                    label={t("game.join.findCode")}
                    href={FRAK_INSTAGRAM_URL}
                />
            </InfoCard>
            <PastGames results={history.data ?? []} />
        </Stack>
    );
}
