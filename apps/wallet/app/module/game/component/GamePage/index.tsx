import type {
    CurrentGameResponse,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    InstagramIcon,
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
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { formatGameEnd } from "@/module/game/utils/formatGameDate";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
import { useRefreshInstagramFollow } from "@/module/instagram/hook/useInstagramLink";

type CurrentGame = NonNullable<ReturnType<typeof useCurrentGame>["data"]>;

type InstagramLevel = CurrentGameResponse["me"]["instagram"];

type OpenGame = NonNullable<CurrentGame["game"]>;

/** The `instagramCertified` ticket source: granted while a certified account follows @frak_fr. */
const CERTIFIED_TICKETS = 2;

/** What tops the page: the open game, or the last result once none is open. */
type Top =
    | { kind: "error" | "loading" | "none" }
    | { kind: "result"; result: GameResult }
    | { kind: "join" | "playing"; game: OpenGame };

/** Cached data wins over a failed refetch: the error shows only when there is nothing to show. */
function topOf(
    current: ReturnType<typeof useCurrentGame>,
    history: ReturnType<typeof useGameHistory>
): Top {
    const data = current.data;
    if (!data) return { kind: current.isError ? "error" : "loading" };
    // History first even when playing: a draw waiting on the user tops the page.
    if (history.isLoading) return { kind: "loading" };
    if (data.game && data.me.participating) {
        return { kind: "playing", game: data.game };
    }
    if (data.game) return { kind: "join", game: data.game };
    const latest = history.data?.[0];
    if (latest) return { kind: "result", result: latest };
    return { kind: history.isError ? "error" : "none" };
}

export function GamePage() {
    const { t, i18n } = useTranslation();
    useRefreshInstagramFollow();
    const current = useCurrentGame();
    const history = useGameHistory();
    const game = current.data?.game;
    const me = current.data?.me;
    const viewedGameId = game && me?.participating ? game.id : null;
    const trackedGameId = useRef<string | null>(null);
    const top = topOf(current, history);
    const results = history.data ?? [];
    const resultShown = top.kind === "result" ? top.result : null;
    const pending = results.find(
        (result) => result.outcome === "pending_verification"
    );
    const trackedResultIds = useRef(new Set<string>());

    useEffect(() => {
        for (const result of [pending, resultShown]) {
            if (!result || trackedResultIds.current.has(result.game.id)) {
                continue;
            }
            trackedResultIds.current.add(result.game.id);
            trackEvent("game_result_viewed", {
                game_id: result.game.id,
                outcome: result.outcome,
            });
        }
    }, [pending, resultShown]);

    // Once per game shown: a refetch with new counts is not a new view.
    useEffect(() => {
        if (!(viewedGameId && me) || trackedGameId.current === viewedGameId) {
            return;
        }
        trackedGameId.current = viewedGameId;
        trackEvent("game_page_viewed", {
            tickets: me.tickets,
            eligible: me.eligible,
            instagram: me.instagram,
            tickets_join: me.ticketsBySource.join,
            tickets_instagram_certified: me.ticketsBySource.instagramCertified,
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
                        onClick: () => {
                            void current.refetch();
                            void history.refetch();
                        },
                    }}
                />
            )}
            {top.kind === "loading" && <Skeleton variant="rect" height={160} />}
            {pending && pending !== resultShown && (
                <GameResultCard result={pending} />
            )}
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
                    instagram={me.instagram}
                />
            )}
            {top.kind !== "loading" && (
                <PastGames
                    results={results.filter(
                        (result) => result !== resultShown && result !== pending
                    )}
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
    instagram,
}: {
    prize: string;
    endsAt: Date | string;
    tickets: number;
    eligible: boolean;
    instagram: InstagramLevel;
}) {
    const { t, i18n } = useTranslation();
    const endDate = formatGameEnd(endsAt, i18n.language);

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
            <InstagramStanding
                eligible={eligible}
                instagram={instagram}
                tickets={tickets}
            />
            <Stack space="xs">
                <Text weight="semiBold">{t("game.page.more")}</Text>
                <InfoCard>
                    {instagram === "declared" && (
                        <InfoRow
                            icon={InstagramIcon}
                            label={t("game.page.certifyCta")}
                            to="/profile/instagram"
                            action={
                                <Badge size="small" variant="success">
                                    {t("game.page.gain", {
                                        count: CERTIFIED_TICKETS,
                                    })}
                                </Badge>
                            }
                        />
                    )}
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

const igLink = <ExternalLink href={FRAK_INSTAGRAM_URL} />;

/** Whether the tickets count, and how to make them count, for each Instagram level. */
function InstagramStanding({
    eligible,
    instagram,
    tickets,
}: {
    eligible: boolean;
    instagram: InstagramLevel;
    tickets: number;
}) {
    const { t } = useTranslation();
    if (instagram === "certified" && eligible) {
        return <Notice tone="success">{t("game.page.certified")}</Notice>;
    }
    if (instagram === "declared") {
        return <Notice tone="info">{t("game.page.declared")}</Notice>;
    }
    if (instagram === "certified") {
        return (
            <Stack space="xs">
                <Notice tone="warning">
                    <Trans
                        i18nKey="game.page.lockedNotFollowing"
                        components={{ igLink }}
                    />
                </Notice>
                <InfoCard>
                    <InfoRow
                        icon={InstagramIcon}
                        label={t("game.page.activateCta")}
                        to="/profile/instagram"
                    />
                </InfoCard>
            </Stack>
        );
    }
    return (
        <Stack space="xs">
            <Notice tone="warning">{t("game.page.lockedNone")}</Notice>
            <InfoCard>
                <InfoRow
                    icon={InstagramIcon}
                    label={t("game.page.certifyCta")}
                    to="/profile/instagram"
                    action={
                        <Badge size="small" variant="success">
                            {t("game.page.counted", {
                                count: tickets + CERTIFIED_TICKETS,
                            })}
                        </Badge>
                    }
                />
                <InfoRow
                    icon={InstagramIcon}
                    label={t("game.page.declareCta")}
                    to="/profile/instagram"
                    action={
                        <Badge size="small" variant="info">
                            {t("game.page.counted", { count: tickets })}
                        </Badge>
                    }
                />
            </InfoCard>
        </Stack>
    );
}
