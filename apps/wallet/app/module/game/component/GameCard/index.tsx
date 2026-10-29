import type {
    CurrentGameResponse,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    ChevronRightIcon,
    GiftIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import { trackEvent } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { useNavigate } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ICONS, REWARDS } from "@/module/game/component/GameMissions";
import { OutcomeBadge } from "@/module/game/component/GameResult";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { useNow } from "@/module/game/hook/useNow";
import { gameSeenStore } from "@/module/game/stores/gameSeenStore";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { formatGameEnd } from "@/module/game/utils/formatGameDate";
import { countdownOf } from "@/module/game/utils/gameCountdown";
import { gainsSince } from "@/module/game/utils/gameGains";
import type { Mission } from "@/module/game/utils/gameMissions";
import {
    type TicketCardStatus,
    ticketCardOf,
} from "@/module/game/utils/gameTicketCard";
import * as styles from "@/module/wallet/component/AddEmailCard/index.css";
import * as ticket from "./index.css";

/** How long after its end a game's result stays on the wallet home. */
const RESULT_CARD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Wallet-home recap: a draw waiting on the user first (straight to certifying),
 * then the open game, or the last game played when it ended recently; hidden otherwise.
 */
export function GameCard() {
    const { t, i18n } = useTranslation();
    const { data } = useCurrentGame();
    const history = useGameHistory();
    const pending = history.data?.find(
        (result) => result.outcome === "pending_verification"
    );

    if (pending) {
        return (
            <GameCardShell
                to="/profile/instagram"
                title={t("game.card.drawn")}
                prize={pending.game}
                detail={
                    pending.verifyBy
                        ? t("game.card.verifyBy", {
                              date: formatGameEnd(
                                  pending.verifyBy,
                                  i18n.language
                              ),
                          })
                        : undefined
                }
                badge={<OutcomeBadge outcome={pending.outcome} />}
            />
        );
    }

    if (data?.game) {
        return <OpenGameCard game={data.game} me={data.me} />;
    }

    const latest = data && history.data?.[0];
    if (!(latest && isRecent(latest))) return null;
    return (
        <GameCardShell
            to="/game"
            title={t("game.card.ended")}
            prize={latest.game}
            badge={<OutcomeBadge outcome={latest.outcome} />}
        />
    );
}

type OpenGame = {
    id: string;
    endsAt: Date | string;
    prizeAmount: number;
    prizeDescription: string | null;
};

type Me = CurrentGameResponse["me"];

const STATUS_TONE = {
    join: "action",
    locked: "locked",
    next: "action",
    allDone: "done",
} as const satisfies Record<TicketCardStatus["kind"], string>;

const countSize = (count: number) =>
    count < 100 ? "short" : count < 1000 ? "medium" : "long";

/** The open game as a ticket: the player's count on the stub, the prize, and the next action. */
export function OpenGameCard({ game, me }: { game: OpenGame; me: Me }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const status = ticketCardOf(me);
    const baseline = gameSeenStore((s) => s.seen[game.id]);
    const gained = me.participating
        ? gainsSince(baseline ?? null, me).total
        : 0;
    const amount = game.prizeDescription === null;
    const prize =
        game.prizeDescription ??
        formatGameAmount(game.prizeAmount, i18n.language);
    const unit = me.participating
        ? t("game.card.ticket", { count: me.tickets })
        : t("game.card.yourTicket");
    const muted = status.kind === "join" || status.kind === "locked";

    return (
        <div className={ticket.root}>
            <div className={ticket.face}>
                <div
                    className={ticket.stub({
                        tone: muted ? "muted" : "active",
                    })}
                >
                    <span
                        aria-hidden="true"
                        className={ticket.count({
                            size: countSize(me.tickets),
                        })}
                    >
                        {me.participating ? me.tickets : "?"}
                    </span>
                    <span aria-hidden="true" className={ticket.unit}>
                        {unit}
                    </span>
                    {status.kind === "locked" && (
                        <LockIcon width={14} height={14} />
                    )}
                    {(status.kind === "next" || status.kind === "allDone") && (
                        <CheckIcon width={14} height={14} />
                    )}
                    {gained > 0 && (
                        <span className={ticket.stamp}>
                            +{gained}
                            <span className={visuallyHidden}>
                                {t("game.card.gained", { count: gained })}
                            </span>
                        </span>
                    )}
                </div>
                <Stack space="xxs" justify="center" className={ticket.main}>
                    <Spread space="xs">
                        <button
                            type="button"
                            className={ticket.mainButton}
                            aria-label={t("game.card.ariaLabel", {
                                prize,
                                tickets: unit,
                            })}
                            onClick={() => {
                                trackEvent("game_card_clicked", {
                                    game_id: game.id,
                                    participating: me.participating,
                                });
                                navigate({
                                    to: me.participating
                                        ? "/game"
                                        : "/game/join",
                                });
                            }}
                        >
                            <Text
                                as="span"
                                variant="caption"
                                weight="semiBold"
                                color="secondary"
                            >
                                {t("game.card.label")}
                            </Text>
                        </button>
                        <Countdown endsAt={game.endsAt} />
                    </Spread>
                    <span
                        className={ticket.headline({
                            kind: amount ? "amount" : "description",
                        })}
                    >
                        {prize}
                    </span>
                    {amount && (
                        <Text variant="bodySmall" color="secondary">
                            {t("game.card.toWin")}
                        </Text>
                    )}
                    <StatusLine
                        status={status}
                        gameId={game.id}
                        onGo={(to) => navigate({ to })}
                    />
                </Stack>
            </div>
        </div>
    );
}

function Countdown({ endsAt }: { endsAt: Date | string }) {
    const { t } = useTranslation();
    const countdown = countdownOf(endsAt, useNow(30_000));
    if (countdown.over) return null;
    return (
        <span className={ticket.pill({ urgent: countdown.urgent })}>
            {countdown.days >= 1
                ? t("game.page.hero.countdownDays", countdown)
                : t("game.page.hero.countdownHours", countdown)}
        </span>
    );
}

function statusText(status: TicketCardStatus, t: DefaultTranslate) {
    switch (status.kind) {
        case "join":
            return {
                title: t("game.card.statusJoin"),
                detail: t("game.card.statusJoinReward"),
            };
        case "locked":
        case "next":
            return {
                title: t(status.mission.title),
                detail: t(REWARDS[status.mission.id], {
                    count: status.mission.reward,
                }),
            };
        case "allDone":
            return { title: t("game.card.statusAllDone"), detail: null };
    }
}

function iconOf(status: TicketCardStatus) {
    if (status.kind === "join") return GiftIcon;
    if (status.kind === "locked") return LockIcon;
    if (status.kind === "next") return ICONS[status.mission.id];
    return CheckIcon;
}

function StatusLine({
    status,
    gameId,
    onGo,
}: {
    status: TicketCardStatus;
    gameId: string;
    onGo: (to: "/game" | "/game/join" | NonNullable<Mission["route"]>) => void;
}) {
    const { t } = useTranslation();
    const mission = "mission" in status ? status.mission : null;
    const go = () => {
        if (mission && mission.id !== "join") {
            trackEvent("game_mission_clicked", {
                mission: mission.id,
                status: mission.status,
                surface: "home_card",
                game_id: gameId,
            });
        }
        onGo(
            mission?.route ?? (status.kind === "join" ? "/game/join" : "/game")
        );
    };
    const Icon = iconOf(status);
    const { title, detail } = statusText(status, t);

    return (
        <button
            type="button"
            className={ticket.status({ tone: STATUS_TONE[status.kind] })}
            onClick={go}
        >
            <Icon width={16} height={16} className={ticket.icon} />
            <span className={ticket.statusText}>
                {title}
                {detail && (
                    <>
                        {" "}
                        <Text as="span" variant="caption" color="secondary">
                            {detail}
                        </Text>
                    </>
                )}
            </span>
            <ChevronRightIcon width={16} height={16} className={ticket.icon} />
        </button>
    );
}

function isRecent(result: GameResult) {
    return Date.now() - new Date(result.game.endsAt).getTime() < RESULT_CARD_MS;
}

function GameCardShell({
    to,
    title,
    prize,
    detail,
    badge,
}: {
    to: "/game" | "/game/join" | "/profile/instagram";
    title: string;
    prize: { prizeAmount: number; prizeDescription: string | null };
    /** Replaces the prize line. */
    detail?: string;
    badge: ReactNode;
}) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const open = () => navigate({ to });
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
    };

    return (
        <Card
            padding="none"
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={handleKeyDown}
        >
            <Box className={styles.layoutRow}>
                <Box className={styles.iconBubble}>
                    <Ticket size={20} />
                </Box>
                <Box className={styles.textBlock}>
                    <Text variant="body" weight="semiBold">
                        {title}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {detail ??
                            prize.prizeDescription ??
                            formatGameAmount(prize.prizeAmount, i18n.language)}
                    </Text>
                    <Box>{badge}</Box>
                </Box>
                <Box className={styles.chevron}>
                    <ChevronRightIcon width={16} height={16} />
                </Box>
            </Box>
        </Card>
    );
}
