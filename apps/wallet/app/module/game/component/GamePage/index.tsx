import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    LinkIcon,
    ReferralIcon,
} from "@frak-labs/design-system/icons";
import { ExternalLink, trackEvent } from "@frak-labs/wallet-shared";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import { OpenGameCard } from "@/module/game/component/GameCard";
import { GameResultCard, PastGames } from "@/module/game/component/GameResult";
import { FRAK_INSTAGRAM_URL, frakGame } from "@/module/game/config";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import {
    type GameResult,
    useGameHistory,
} from "@/module/game/hook/useGameHistory";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";

type CurrentGame = NonNullable<ReturnType<typeof useCurrentGame>["data"]>;

type OpenGame = NonNullable<CurrentGame["game"]>;

/** What tops the page: the open game, or the last result once none is open. */
type Top =
    | { kind: "error" | "loading" | "none" }
    | { kind: "result"; result: GameResult }
    | { kind: "join" | "playing"; game: OpenGame };

function topOf(
    current: ReturnType<typeof useCurrentGame>,
    history: ReturnType<typeof useGameHistory>
): Top {
    if (current.isError) return { kind: "error" };
    const data = current.data;
    if (!data) return { kind: "loading" };
    if (data.game && data.me.participating) {
        return { kind: "playing", game: data.game };
    }
    if (history.isLoading) return { kind: "loading" };
    if (data.game) return { kind: "join", game: data.game };
    const latest = history.data?.[0];
    return latest ? { kind: "result", result: latest } : { kind: "none" };
}

export function GamePage() {
    const { t, i18n } = useTranslation();
    const current = useCurrentGame();
    const history = useGameHistory();
    const game = current.data?.game;
    const me = current.data?.me;
    const viewedGameId = game && me?.participating ? game.id : null;
    const trackedGameId = useRef<string | null>(null);
    const top = topOf(current, history);
    const results = history.data ?? [];
    const resultShown = top.kind === "result" ? top.result : null;
    const trackedResultId = useRef<string | null>(null);

    useEffect(() => {
        if (!resultShown || trackedResultId.current === resultShown.game.id) {
            return;
        }
        trackedResultId.current = resultShown.game.id;
        trackEvent("game_result_viewed", {
            game_id: resultShown.game.id,
            outcome: resultShown.outcome,
        });
    }, [resultShown]);

    // Once per game shown: a refetch with new counts is not a new view.
    useEffect(() => {
        if (!(viewedGameId && me) || trackedGameId.current === viewedGameId) {
            return;
        }
        trackedGameId.current = viewedGameId;
        trackEvent("game_page_viewed", {
            tickets: me.tickets,
            eligible: me.eligible,
            tickets_join: me.ticketsBySource.join,
            tickets_purchase: me.ticketsBySource.purchase,
            tickets_referred_purchase: me.ticketsBySource.referredPurchase,
            tickets_referred_signup: me.ticketsBySource.referredSignup,
            tickets_brand_share: me.ticketsBySource.brandShare,
        });
    }, [viewedGameId, me]);

    // With past games to show, a user not in the open game still gets the page.
    if (top.kind === "join" && results.length === 0) {
        return <Navigate to="/game/join" replace />;
    }

    return (
        <Stack space="m">
            <Back href="/wallet" />
            <Title size="page">{t("game.page.title")}</Title>
            {top.kind === "error" && (
                <EmptyState
                    title={t("game.page.error")}
                    action={{
                        label: t("game.page.retry"),
                        onClick: () => void current.refetch(),
                    }}
                />
            )}
            {top.kind === "loading" && <Skeleton variant="rect" height={160} />}
            {top.kind === "none" && (
                <EmptyState
                    title={t("game.page.none.title")}
                    description={t("game.page.none.description")}
                />
            )}
            {top.kind === "join" && (
                <OpenGameCard game={top.game} participating={false} />
            )}
            {top.kind === "result" && <GameResultCard result={top.result} />}
            {top.kind === "playing" && me && (
                <GameDetails
                    prize={
                        top.game.prizeDescription ??
                        formatGameAmount(top.game.prizeAmount, i18n.language)
                    }
                    endsAt={top.game.endsAt}
                    tickets={me.tickets}
                    eligible={me.eligible}
                />
            )}
            {top.kind !== "loading" && (
                <PastGames
                    results={top.kind === "result" ? results.slice(1) : results}
                />
            )}
        </Stack>
    );
}

function GameDetails({
    prize,
    endsAt,
    tickets,
    eligible,
}: {
    prize: string;
    endsAt: Date | string;
    tickets: number;
    eligible: boolean;
}) {
    const { t, i18n } = useTranslation();
    const endDate = new Date(endsAt).toLocaleString(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <>
            <Card>
                <Stack space="xs" align="center">
                    <Text variant="display1" as="p">
                        {tickets}
                    </Text>
                    <Text color="secondary">
                        {t("game.page.tickets", { count: tickets })}
                    </Text>
                    <Text weight="semiBold" align="center">
                        {prize}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("onboarding.game.reward.game.endsAt", {
                            date: endDate,
                        })}
                    </Text>
                </Stack>
            </Card>
            {eligible ? (
                <Notice tone="success">
                    {t("game.instagram.linked.counting")}
                </Notice>
            ) : (
                <Stack space="xs">
                    <Notice tone="warning">
                        <Trans
                            i18nKey={
                                frakGame.instagramLink
                                    ? "game.page.lockedLink"
                                    : "game.page.locked"
                            }
                            components={{
                                igLink: (
                                    <ExternalLink href={FRAK_INSTAGRAM_URL} />
                                ),
                            }}
                        />
                    </Notice>
                    {frakGame.instagramLink && (
                        <InfoCard>
                            <InfoRow
                                icon={LinkIcon}
                                label={t("game.page.linkCta")}
                                to="/game/instagram"
                            />
                        </InfoCard>
                    )}
                </Stack>
            )}
            <Stack space="xs">
                <Text weight="semiBold">{t("game.page.more")}</Text>
                <InfoCard>
                    <InfoRow
                        icon={ReferralIcon}
                        label={t("game.page.share")}
                        to="/profile/referral/share"
                        action={
                            <Badge size="small" variant="success">
                                {t("game.page.gain", { count: 1 })}
                            </Badge>
                        }
                    />
                    <InfoRow
                        icon={CartIcon}
                        label={t("game.page.buy")}
                        to="/explorer"
                        action={
                            <Badge size="small" variant="success">
                                {t("game.page.gain", { count: 3 })}
                            </Badge>
                        }
                    />
                </InfoCard>
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.shareHint")}
                </Text>
            </Stack>
        </>
    );
}
